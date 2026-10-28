#!/usr/bin/env node
/**
 * Post-deploy contract checks for a running YemReact instance.
 *
 * Usage:
 *   node scripts/verify-deployment.mjs <baseUrl> [--expect-revision <sha>] [--wait 900]
 *                                        [--poll 15] [--json <path>] [--request-timeout 20000]
 *                                        [--warm 0]
 *
 * Runs in GitHub Actions ("التحقق من معاينة Render" job) and locally against any
 * instance. It only reads public endpoints; it never authenticates and never mutates
 * data. `--warm <s>` wakes a sleeping free-preview (Render) with a bounded, logged
 * poll before the checks: on timeout the checks still run so every route surfaces
 * its real error. Nothing here weakens the assertions to make them pass.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deploymentReady } from './deployment-wait.mjs';

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf('--' + name);
  return index === -1 ? fallback : args[index + 1];
}
const baseUrl = (args.find((arg) => !arg.startsWith('--') && /^https?:\/\//.test(arg)) || '')
  .trim()
  .replace(/\/+$/, '');
if (!baseUrl) {
  console.error(
    'الاستخدام: node scripts/verify-deployment.mjs <baseUrl> [--expect-revision <sha>]',
  );
  process.exit(2);
}
const expectRevision = option('expect-revision', '');
const deployedAt = option('deployed-at', '');
const waitSeconds = Number(option('wait', 900));
const pollSeconds = Number(option('poll', 15));
const warmSeconds = Number(option('warm', process.env.VERIFY_WARM_SECONDS || 0));
const requestTimeout = Number(
  option('request-timeout', process.env.VERIFY_REQUEST_TIMEOUT || 20000),
);
const jsonPath = option('json', '');
const origin = new URL(baseUrl).origin;
const results = [];
const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}
/** Job logs are not readable from outside the UI, so failures also become annotations. */
function annotate(level, title, message) {
  if (!process.env.GITHUB_ACTIONS) return;
  const escape = (text) =>
    String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').slice(0, 1500);
  console.log(`::${level} title=${escape(title)}::${escape(message)}`);
}
async function request(url, init = {}) {
  return fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeout),
    ...init,
  });
}
/** One failing check must not hide the others, so each runs in isolation. */
async function check(id, label, run) {
  try {
    const detail = await run();
    results.push({ id, label, ok: true, detail: detail || '' });
    console.log(`✅ ${label}${detail ? ' — ' + detail : ''}`);
  } catch (e) {
    results.push({ id, label, ok: false, detail: e.message || String(e) });
    console.log(`❌ ${label} — ${e.message || e}`);
    annotate('error', label, e.message || String(e));
  }
}

/** Render يعيد بناء المعاينة من main بشكل غير زامن، فانتظر حتى تخدم بناء هذا التشغيل فعلًا. */
async function waitForRevision() {
  const deadline = Date.now() + waitSeconds * 1000;
  let note = 'لم تبدأ المحاولة بعد';
  const maxAttempts = Math.max(1, Math.ceil(waitSeconds / Math.max(1, pollSeconds)) + 1);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let verdict;
    try {
      const res = await request(`${origin}/api/health`);
      let body = {};
      if (res.status === 200) {
        try {
          body = await res.json();
        } catch {
          body = {};
        }
      }
      verdict = deploymentReady({
        status: res.status,
        revision: String(body.revision || ''),
        startedAt: String(body.startedAt || ''),
        expectRevision,
        deployedAt,
      });
    } catch (e) {
      verdict = { ready: false, note: `تعذّر الوصول إلى الخدمة: ${e.message}` };
    }
    if (verdict.ready) return { ready: true, note: verdict.note };
    note = verdict.note;
    if (Date.now() + pollSeconds * 1000 >= deadline) break;
    console.log(`⏳ ${note} — إعادة الفحص خلال ${pollSeconds} ثانية`);
    await sleep(pollSeconds);
  }
  return { ready: false, note };
}

/**
 * Render's free tier sleeps after inactivity; the first request only starts the
 * wake-up, then times out. This bounded, visible warm-up wakes the preview before
 * the checks. On timeout we do NOT skip anything: the checks run and report each
 * route's real error (no bypass, no fabricated data).
 */
async function wakePreview() {
  if (warmSeconds <= 0) return;
  const deadline = Date.now() + warmSeconds * 1000;
  let attempt = 0;
  let last = 'بلا محاولة بعد';
  for (;;) {
    attempt += 1;
    try {
      const res = await request(`${origin}/api/health`);
      if (res.status === 200) {
        if (attempt > 1) console.log(`✅ المعاينة مستيقظة بعد ${attempt} محاولات.`);
        return;
      }
      last = `حالة /api/health: ${res.status}`;
    } catch (e) {
      last = `تعذّر الوصول (${e.message || e})`;
    }
    if (Date.now() + pollSeconds * 1000 >= deadline) {
      console.log(
        `⚠️ انتهت مهلة إيقاظ المعاينة (${warmSeconds} ثانية): ${last} — ستمضي جميع الفحوص لتُظهر الخطأ الحقيقي لكل مسار.`,
      );
      return;
    }
    console.log(
      `⏳ إيقاظ المعاينة (محاولة ${attempt}): ${last} — إعادة المحاولة خلال ${pollSeconds} ثانية`,
    );
    await sleep(pollSeconds);
  }
}
await wakePreview();

let revisionNote = '';
if (expectRevision) {
  console.log(`⏳ انتظار نشر الإصدار ${expectRevision.slice(0, 7)} على ${origin} …`);
  const waited = await waitForRevision();
  revisionNote = waited.note;
  if (!waited.ready) {
    results.push({
      id: 'deployment-ready',
      label: 'وصول الإصدار الجديد إلى المعاينة',
      ok: false,
      detail: `انتهت مهلة الانتظار (${waitSeconds} ثانية): ${waited.note}. تأكد أن Render أنشأ نشرة تلقائية من هذا الالتزام على فرع main (Auto Deploy)، ثم أعد التشغيل.`,
    });
    console.log(`❌ وصول الإصدار الجديد إلى المعاينة — ${waited.note}`);
    annotate('error', 'وصول الإصدار الجديد إلى المعاينة', waited.note);
  } else {
    results.push({
      id: 'deployment-ready',
      label: 'وصول الإصدار الجديد إلى المعاينة',
      ok: true,
      detail: waited.note,
    });
    console.log(`✅ وصول الإصدار الجديد إلى المعاينة — ${waited.note}`);
  }
}

await check('root-gateway', 'الجذر / بوّابة دخول تُجيب HTML مباشرة', async () => {
  // كان الجذر إحالة دائمة إلى /library؛ صار صفحة بوّابة تعرض الدخول للزائر
  // وتُحيل المسجَّل فورًا إلى المكتبة (قرار «بوّابة الدخول» مرحلة ١).
  const res = await request(`${origin}/`, { headers: { Accept: 'text/html' } });
  expect(res.status === 200, `الحالة ${res.status} بدل 200`);
  const body = await res.text();
  expect(body.includes('dir="rtl"'), 'الردّ ليس HTML عربي RTL');
  return `${res.status} · HTML`;
});

await check('library-page', 'صفحة المكتبة عربية RTL وتُقدَّم كHTML', async () => {
  const started = Date.now();
  const res = await request(`${origin}/library`);
  expect(res.status === 200, `الحالة ${res.status}`);
  const type = res.headers.get('content-type') || '';
  expect(type.includes('text/html'), `نوع المحتوى ${type}`);
  const html = await res.text();
  expect(/<html[^>]+lang="ar"/.test(html), 'الوسم <html> لا يحمل lang="ar"');
  expect(/<html[^>]+dir="rtl"/.test(html), 'الوسم <html> لا يحمل dir="rtl"');
  expect(html.includes('المكتبة'), 'لا يظهر عنوان المكتبة في الصفحة');
  return `200 · ${html.length} حرفًا · ${Date.now() - started}ms`;
});

await check('health-endpoint', 'عقد /api/health وتقييم الإعداد', async () => {
  const res = await request(`${origin}/api/health`);
  expect(res.status === 200, `الحالة ${res.status}`);
  const body = await res.json();
  expect(['ok', 'warn', 'fail'].includes(body.level), `مستوى غير معروف: ${body.level}`);
  expect(Array.isArray(body.checks) && body.checks.length >= 7, 'قائمة الفحوص ناقصة');
  const problems = body.checks.filter((item) => item.level === 'fail').map((item) => item.id);
  expect(!problems.length, `فحوص فاشلة: ${problems.join(', ')}`);
  const warnings = body.checks.filter((item) => item.level === 'warn');
  expect(body.ok !== false, 'الخدمة تُبلّغ عن خلل فادح في الإعداد');
  // التنبيهات لا تُسقط التشغيل، لكنها تبقى مرئية في الواجهة لا في سجل غير مقروء.
  if (warnings.length)
    annotate('warning', 'تنبيهات إعداد المعاينة', warnings.map((item) => item.detail).join(' · '));
  return [
    `المستوى ${body.level}`,
    body.revision ? `الإصدار ${String(body.revision).slice(0, 7)}` : 'بلا إصدار معلن',
    `رياكشنات ${body.counts?.reactions ?? '؟'}`,
    warnings.length ? `تنبيهات: ${warnings.map((item) => item.id).join(', ')}` : 'بلا تنبيهات',
  ].join(' · ');
});

await check('catalog-api', 'واجهة الرياكشنات العامة', async () => {
  const res = await request(`${origin}/api/reactions`);
  expect(res.status === 200, `الحالة ${res.status}`);
  expect(
    (res.headers.get('cache-control') || '').includes('no-store'),
    'الاستجابة غير مُعلَّمة بـno-store',
  );
  const body = await res.json();
  expect(Array.isArray(body.reactions) && body.reactions.length > 0, 'لا توجد رياكشنات في الرد');
  return `${body.reactions.length} رياكشن`;
});

/** يميّز بين قيمة منشورة خاطئة وبين استجابة قديمة مخزّنة مؤقتًا. */
async function explainOriginMismatch(pathname, observed, expected) {
  const busted = await request(`${origin}${pathname}?cb=${Date.now()}`);
  const fresh = busted.status === 200 ? await busted.text() : '';
  if (fresh.includes(expected))
    return `القيمة المنشورة صحيحة لكن الاستجابة المخزّنة مؤقتًا قديمة (${observed}). أعد النشر أو أفرغ الذاكرة المؤقتة.`;
  return `${observed} بدل ${expected}`;
}

await check('sitemap-origin', 'sitemap يشير إلى النطاق العام الصحيح', async () => {
  const res = await request(`${origin}/sitemap.xml`);
  expect(res.status === 200, `الحالة ${res.status}`);
  const xml = await res.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(locations.length > 0, 'لا توجد عناوين في sitemap');
  const foreign = locations.filter((location) => !location.startsWith(origin));
  if (foreign.length)
    throw new Error(
      `NEXT_PUBLIC_SITE_URL غير مضبوط وقت البناء أو يحمل شرطة زائدة — ${await explainOriginMismatch('/sitemap.xml', foreign[0], origin)}`,
    );
  return `${locations.length} عنوانًا على ${origin}`;
});

await check('robots-origin', 'robots.txt يعلن sitemap الصحيح', async () => {
  const res = await request(`${origin}/robots.txt`);
  expect(res.status === 200, `الحالة ${res.status}`);
  const text = await res.text();
  const declared = (text.match(/^\s*Sitemap:\s*(\S+)\s*$/im) || [])[1] || 'لا سطر Sitemap';
  if (!text.includes(`${origin}/sitemap.xml`))
    throw new Error(await explainOriginMismatch('/robots.txt', declared, `${origin}/sitemap.xml`));
  return 'مطابق للنطاق العام';
});

await check('security-headers', 'ترويسات الأمان الأساسية', async () => {
  const res = await request(`${origin}/library`);
  const nosniff = res.headers.get('x-content-type-options') || '';
  const referrer = res.headers.get('referrer-policy') || '';
  const permissions = res.headers.get('permissions-policy') || '';
  expect(nosniff.toLowerCase() === 'nosniff', `X-Content-Type-Options: ${nosniff || 'مفقود'}`);
  expect(referrer.length > 0, 'Referrer-Policy مفقود');
  expect(permissions.includes('camera=()'), `Permissions-Policy: ${permissions || 'مفقود'}`);
  return `nosniff · referrer ${referrer} · permissions مضبوطة`;
});

await check('detail-route', 'صفحة التفاصيل تعمل والرمز المجهول يُرجع 404', async () => {
  // رمز ثابت (مثل YR-0001) افتراض محلي فقط؛ المعاينة تستحق رمزًا موجودًا فعلًا:
  const catalog = await (await request(`${origin}/api/reactions`)).json();
  const realCode = catalog.reactions?.[0]?.code;
  expect(realCode, 'كتالوج المعاينة بلا رياكشنات يمكن فحص تفاصيلها');
  const known = await request(`${origin}/r/${realCode}`);
  expect(known.status === 200, `رمز موجود فعلًا (${realCode}) أعاد ${known.status}`);
  const missing = await request(`${origin}/r/NOPE-9999`);
  expect(missing.status === 404, `رمز مجهول أعاد ${missing.status} بدل 404`);
  return `${realCode} · 200 · 404`;
});

// زائر بلا كوكي «استمرار كزائر» تتوقع له البوابة إحالة إلى /login مع next محفوظ.
// وبعد الدفعة 3: /saved لم يعد صفحة مستقلة — الزائر المختار يلقى 307 إلى /account
// حيث قسم المحفوظات الدائم يعيش. الفحص يُباصر العقد الجديد حرفيًّا (الإحالة +
// الوجهة + محتواها) بدل تخفيفه: لا تجاوز للفشل، بل مواءمة مع العقد المعتمد.
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 YemReactDeployCheck/1.0';
await check(
  'guest-gate-contract',
  'الزائر غير المختار يُحال للبوابة، والزائر المختار /saved ⇒ 307 نحو حسابه بمحفوظاته',
  async () => {
    const gatedPath = '/saved';
    const anonymous = await request(`${origin}${gatedPath}`, {
      headers: { 'user-agent': BROWSER_UA, Accept: 'text/html' },
    });
    const location = anonymous.headers.get('location') || '';
    expect(
      [301, 302, 303, 307, 308].includes(anonymous.status) &&
        location.includes('/login') &&
        decodeURIComponent(location).includes(`next=${gatedPath}`),
      `زائر بلا كوكي على ${gatedPath}: ${anonymous.status} → ${location || 'بلا وجهة'}`,
    );
    const chosen = await request(`${origin}${gatedPath}`, {
      headers: { 'user-agent': BROWSER_UA, cookie: 'yr_guest=1' },
    });
    const chosenLocation = chosen.headers.get('location') || '';
    expect(
      chosen.status === 307 && chosenLocation.replace(/\/+$/, '').endsWith('/account'),
      `الزائر المختار على /saved: ${chosen.status} → ${chosenLocation || 'بلا وجهة'} (المتوقع 307 → /account)`,
    );
    // الوجهة نفسها تُثبت: صفحة الحساب تقدّم مبدّل المحفوظات/مساهماتي للزائر المختار.
    const account = await request(`${origin}/account`, {
      headers: { 'user-agent': BROWSER_UA, cookie: 'yr_guest=1' },
    });
    const html = await account.text();
    expect(account.status === 200, `/account للزائر المختار أعاد ${account.status} بدل 200`);
    expect(/<html[^>]+dir="rtl"/.test(html), 'تفضيلات الزائر المختار بلا HTML عربي');
    expect(/المحفوظات/.test(html) && /مساهماتي/.test(html), 'وجهة /account بلا قسم المحفوظات');
    return `${anonymous.status} → ${chosen.status} → 200 بمحفوظاته`;
  },
);

// الإثبات الحي الحاسم لوجود الصفحتين نفسهما: الإحالة وحدها لا تكفي (البوابة
// تحول أي مسار غير أصل) — والحاكم هو 200 بمحتواهما لدى الزائر المختار.
await check(
  'account-settings-live',
  'صفحتا حسابك والإعدادات تقدّمان محتواهما الخاص في المعاينة',
  async () => {
    for (const [pagePath, markers] of [
      ['/account', [/<h1 id="account-title">حسابك/, /مساهماتي/, /href="\/settings"/]],
      ['/settings', [/<h1 id="settings-title">الإعدادات/, /المظهر/, /استعادة الإعدادات/]],
    ]) {
      const anon = await request(`${origin}${pagePath}`, {
        headers: { 'user-agent': BROWSER_UA, Accept: 'text/html' },
      });
      expect(
        [301, 302, 303, 307, 308].includes(anon.status),
        `${pagePath} بلا كوكي أعاد ${anon.status} — غائب النسخة القديمة لا بدليل أن تعترف بذلك (404) إن لم تُلغ`,
      );
      const guest = await request(`${origin}${pagePath}`, {
        headers: { 'user-agent': BROWSER_UA, cookie: 'yr_guest=1' },
      });
      const html = await guest.text();
      expect(guest.status === 200, `${pagePath} للزائر المختار أعاد ${guest.status} بدل 200`);
      for (const marker of markers)
        expect(marker.test(html), `${pagePath} بلا ${marker.source} — محتوى آخر؟`);
      expect(!/account-profile-email/.test(html), `${pagePath} يعرض بريدًا: تسريب بريد البلاغ`);
      expect(/<html[^>]+dir="rtl"/.test(html), `${pagePath} بلا اتجاه عربي`);
    }
    return '200 × 2 بمحتوى الصفحتين';
  },
);

await check('media-delivery', 'تسليم الوسائط من القرص الدائم', async () => {
  const catalog = await (await request(`${origin}/api/reactions`)).json();
  const reaction = catalog.reactions.find((item) => item.media);
  expect(reaction, 'لا يوجد رياكشن بوسائط');
  const res = await request(new URL(reaction.media, origin).toString());
  expect(res.status === 200, `الحالة ${res.status} للوسائط ${reaction.media}`);
  const type = res.headers.get('content-type') || '';
  expect(/^(video|image)\//.test(type), `نوع محتوى غير متوقع: ${type}`);
  if (reaction.media.startsWith('/api/media/')) {
    const ranged = await request(new URL(reaction.media, origin).toString(), {
      headers: { Range: 'bytes=0-1023' },
    });
    expect(ranged.status === 206, `طلب Range أعاد ${ranged.status} بدل 206`);
    expect(
      (ranged.headers.get('content-range') || '').startsWith('bytes 0-'),
      'Content-Range مفقود أو غير صحيح',
    );
    return `${type} · Range 206`;
  }
  return `${type} · ملف مضمّن ${reaction.media}`;
});

await check('public-pages', 'الصفحات العامة الأساسية', async () => {
  // '/saved' خارج القائمة عمدًا منذ الدفعة 3: ليس صفحة عامة مجهولة (يحبسه عقد
  // الدخول) بل يحوّل المختارين إلى /account — تُباصره فحوص guest-gate-contract.
  const pages = ['/collections', '/help', '/privacy', '/login'];
  const failed = [];
  for (const page of pages) {
    const res = await request(`${origin}${page}`);
    if (res.status !== 200) failed.push(`${page}: ${res.status}`);
  }
  expect(!failed.length, failed.join(' · '));
  return pages.join(' · ');
});

const failures = results.filter((result) => !result.ok);
const summary = [
  `| الفحص | النتيجة | التفاصيل |`,
  `| --- | --- | --- |`,
  ...results.map(
    (result) =>
      `| ${result.label} | ${result.ok ? '✅' : '❌'} | ${result.detail.replace(/\|/g, '\\|')} |`,
  ),
].join('\n');
console.log('\n' + summary.replace(/\n/g, '\n'));
console.log(`\nالنتيجة: ${results.length - failures.length}/${results.length} ناجحة على ${origin}`);

// خلاصة النتيجة تُنشر أيضًا كتنبيه مرئي: الأثر والسجلات قد لا يكونان مقروءين من
// أدوات المتابعة، بينما صفحة التشغيل وواجهتها البرمجية تعرضان التنبيهات دائمًا.
annotate(
  failures.length ? 'warning' : 'notice',
  failures.length ? 'فشل تحقق المعاينة' : 'نجح تحقق المعاينة',
  failures.length
    ? `${results.length - failures.length}/${results.length} على ${origin}: ${failures.map((item) => item.label).join(' · ')}${revisionNote ? ` — ${revisionNote}` : ''}`
    : `${results.length}/${results.length} فحصًا ناجحًا على ${origin}${
        expectRevision ? ` عند المراجعة ${expectRevision.slice(0, 7)}` : ''
      }${revisionNote ? ` — ${revisionNote}` : ''}`,
);

if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## تحقق المعاينة — ${origin}\n\n${summary}\n\n${
      failures.length ? `**فشل ${failures.length} من ${results.length}**` : '**كل الفحوص ناجحة.**'
    }\n`,
    { flag: 'a' },
  );
}
if (jsonPath) {
  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        baseUrl: origin,
        checkedAt: new Date().toISOString(),
        expectedRevision: expectRevision || null,
        ok: !failures.length,
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
process.exit(failures.length ? 1 : 0);
