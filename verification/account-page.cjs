/*
 * صفحتا الحساب والإعدادات حيًّا: الصفحتان موجودتان وتحملان محتواهما للزائر
 * المختار (yr_guest) ولصاحب جلسة حقيقية، البوابة تتحوّط عن الزائر غير المختار
 * ثم تعيده إلى الوجهة نفسها، لا ملفات عامة، بريد Google غائب من صفحة الحساب،
 * الرأس العام نظيف كما كان، الشريط السفلي بتبويباته الثلاثة (المكتبة، المجموعات،
 * الحساب) بلا «اضافة» ولا «محفوظات»، وقديم /saved يحوّل (307) إلى /account حيث
 * قسم المحفوظات الدائم. الدفعة 3: PATCH /api/auth لم يعد موجودًا أصلًا — الجميع
 * بلا استثناء (حتى أصحاب الجلسات) يلقون 405، وواجهة تحرير الهوية ذهبت نهائيًّا.
 * فحوص PATCH قاصرة على خادم محلي حصرًا — لا تُرسل كتابة إلى النسخة الحية أبدًا.
 * الاستخدام: node verification/account-page.cjs [base=http://localhost:3000]
 */
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const Database = require('better-sqlite3');

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const isLocalServer = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 YemReactAccountCheck/2.0';
const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
let pass = 0;
const failures = [];
function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`✅ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failures.push(label);
    console.log(`❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}
async function call(urlPath, { cookie = '', method = 'GET', headers = {}, body } = {}) {
  const merged = {
    'user-agent': BROWSER_UA,
    accept: HTML_ACCEPT,
    origin: base,
    referer: base + '/library',
    ...headers,
  };
  if (cookie) merged.cookie = cookie;
  if (body) merged['content-type'] = 'application/json';
  const res = await fetch(base + urlPath, { method, redirect: 'manual', headers: merged, body });
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    body: text,
    location: res.headers.get('location'),
  };
}
const headerSlice = (html) => {
  const start = html.indexOf('<header class="site-header"');
  const end = html.indexOf('</header>', start);
  return start >= 0 && end > start ? html.slice(start, end) : '';
};
const redirectsToLoginKeeping = (res, pathFor) =>
  [301, 302, 303, 307, 308].includes(res.status) &&
  !!res.location &&
  res.location.includes('/login') &&
  decodeURIComponent(res.location).includes(`next=${pathFor}`);

(async () => {
  await call('/api/auth'); // يضمن تهيئة قاعدة البيانات قبل أي بذر
  const guestCookie = 'yr_guest=1';

  // ١: الرأس العام (التقديم الأول من الخادم) خالٍ من تحرير الحساب والنشر
  const library = await call('/library', { cookie: guestCookie });
  check('GET /library للزائر — 200', library.status === 200, `${library.status}`);
  const header = headerSlice(library.body);
  check(
    'شريط الرأس موجود وبنية الصف كما كانت',
    /header-row/.test(header) && /library-search/.test(header),
  );
  check(
    'لا زر «إرسال رياكشن» ولا «الإعدادات» ولا «تحرير الهوية» في شريط الرأس العام',
    !/إرسال رياكشن|الإعدادات|تحرير الهوية/.test(header),
  );
  const glass = library.body.match(/<nav class="glass-nav"[\s\S]*?<\/nav>/);
  const glassTabs = glass ? (glass[0].match(/class="gnav-tab/g) || []).length : 0;
  const glassOrder = glass
    ? glass[0].indexOf('المكتبة') > -1 &&
      glass[0].indexOf('المجموعات') > glass[0].indexOf('المكتبة') &&
      glass[0].indexOf('الحساب') > glass[0].indexOf('المجموعات')
    : false;
  check(
    'الشريط السفلي قائم بتبويباته الثلاثة بالترتيب: المكتبة، المجموعات، الحساب',
    glassTabs === 3 && glassOrder,
    glass ? `${glassTabs} تبويبات` : 'مفقود',
  );
  check(
    'لا «اضافة» ولا «المحفوظات» ولا روابط /contribute أو /saved داخل شريط الهاتف',
    !!glass && !/اضافة|المحفوظات|href="\/contribute"|href="\/saved"/.test(glass[0]),
  );

  // ٢–٣: عقد البوابة كما هو على المسارين الجديدين (بلا أي تعديل على الحماية)
  const anonAccount = await call('/account');
  check(
    '/account بلا كوكي ⇒ إحالة إلى /login مع next=/account (لا 404)',
    redirectsToLoginKeeping(anonAccount, '/account'),
    `${anonAccount.status} → ${anonAccount.location || 'بلا وجهة'}`,
  );
  const anonSettings = await call('/settings');
  check(
    '/settings بلا كوكي ⇒ إحالة إلى /login مع next=/settings',
    redirectsToLoginKeeping(anonSettings, '/settings'),
    `${anonSettings.status} → ${anonSettings.location || 'بلا وجهة'}`,
  );
  // الصفحتان خلف البوابة: 307 الدليلُ أن المسار معروف — و200 أدناه دليل المحتوى
  check(
    'الإحالة نفسها تثبت أن المسارين موجودان (لا 404 ولا 200 مسرّب)',
    anonAccount.status !== 404 &&
      anonSettings.status !== 404 &&
      anonAccount.status !== 200 &&
      anonSettings.status !== 200,
  );

  // ٤: صفحة الحساب حية بمحتواها للزائر بعد «الاستمرار كزائر»
  const account = await call('/account', { cookie: guestCookie });
  check('/account للزائر المختار — 200', account.status === 200, `${account.status}`);
  check(
    'الصفحة «حسابك» بهويتها المطلوبة (ترحيب بالزائر + دخول واضح)',
    /<h1 id="account-title">حسابك<\/h1>/.test(account.body) && /أنت زائر/.test(account.body),
  );
  check(
    'الإجراءان المباشران على الصفحة: إرسال رياكشن ← /contribute والإعدادات ← /settings',
    /href="\/contribute"/.test(account.body) && /href="\/settings"/.test(account.body),
  );
  check(
    'المبدّل الوحيد بلسانيه «المحفوظات» و«مساهماتي»',
    /role="tablist"/.test(account.body) &&
      /المحفوظات/.test(account.body) &&
      /مساهماتي/.test(account.body),
  );
  check(
    'فراغ المحفوظات للزائر ينتهي بفعل واضح (تصفح المكتبة)',
    /ما عندك محفوظات محلية بعد\./.test(account.body) && /href="\/library"/.test(account.body),
  );
  check(
    'لا بريد Google ولا بريد خدمة الدخول في صفحة الحساب إطلاقًا',
    !/account-profile-email|@[a-z0-9.-]+\.[a-z]{2,}"/i.test(account.body),
  );
  check(
    'لا عدّادات ملخّص للزائر (account-summary غائب تمامًا)',
    !/account-summary/.test(account.body),
  );
  check('لا تعديل اسم للزائر ولا تسجيل خروج', !/تحرير الهوية|تسجيل الخروج/.test(account.body));
  check(
    'لا نص عام مفسر «المنشورة» يدّعي دلالة النشر في بطاقات الحساب',
    !/المساهمات المنشورة/.test(account.body),
  );

  // ٤ب: الدفعة 3 — /saved لم تعد صفحة مستقلة: 307 إلى /account بقسم محفوظاته
  // الدائم، ومحفوظة الزائر المحلية تعرضها الصفحة نفسها دون أي دمج أو رفع.
  const savedGuest = await call('/saved', { cookie: guestCookie });
  check(
    '/saved للزائر المختار ⇒ 307 يوجّه إلى /account',
    savedGuest.status === 307 && (savedGuest.location || '').includes('/account'),
    `${savedGuest.status} → ${savedGuest.location || 'بلا وجهة'}`,
  );
  const anonSaved = await call('/saved');
  check(
    'البوابة على المسار القديم كما هي: /saved بلا كوكي ⇒ /login?next=/saved',
    redirectsToLoginKeeping(anonSaved, '/saved'),
    `${anonSaved.status} → ${anonSaved.location || 'بلا وجهة'}`,
  );

  // ٥: صفحة الإعدادات المستقلة حية بأقسامها الخمسة للزائر نفسه
  const settings = await call('/settings', { cookie: guestCookie });
  check('/settings للزائر المختار — 200', settings.status === 200, `${settings.status}`);
  check(
    'صفحة «الإعدادات» بالأقسام الخمسة كما كانت في النافذة القديمة',
    /<h1 id="settings-title">الإعدادات<\/h1>/.test(settings.body) &&
      ['المظهر', 'لونك المفضّل', 'تخفيف الحركة', 'المكتبة معك', 'استعادة الإعدادات'].every((s5) =>
        settings.body.includes(s5),
      ),
  );
  check('الصفحة عربية الاتجاه rtl', /<html[^>]+dir="rtl"/.test(settings.body));

  // ٦: لا ملفات شخصية عامة (مسارات أصدقاء الحساب تبقى 404)
  for (const path404 of ['/account/profile', '/u/ay-one', '/users/hamdan']) {
    const r = await call(path404, { cookie: guestCookie });
    check(`${path404} ⇒ 404 — لا ملفات عامة`, r.status === 404, `${r.status}`);
  }

  // ٧: وجهتا النشر و«مساهماتي» القائمتان تعملان (لم يتغيّرا)
  const contribute = await call('/contribute', { cookie: guestCookie });
  check('وجهة النشر /contribute — 200', contribute.status === 200, `${contribute.status}`);
  const subs = await call('/account/submissions', { cookie: guestCookie });
  check(
    'وجهة «مساهماتي» القائمة /account/submissions — 200',
    subs.status === 200,
    `${subs.status}`,
  );

  // ٨: PATCH أُزيل كليًّا في الدفعة 3 — الجميع بلا استثناء يلقى 405 (على أي بيئة)
  const patchGuest = await call('/api/auth', {
    method: 'PATCH',
    body: JSON.stringify({ name: 'زائر متلصص' }),
  });
  check(
    'PATCH بلا جلسة ⇒ 405 (المعالج لم يعد موجودًا أصلًا)',
    patchGuest.status === 405,
    `${patchGuest.status}`,
  );
  const patchCookieFlag = await call('/api/auth', {
    method: 'PATCH',
    cookie: guestCookie,
    body: JSON.stringify({ name: 'زائر بعلم' }),
  });
  check(
    'PATCH بكوكي yr_guest فقط (لا جلسة) ⇒ 405',
    patchCookieFlag.status === 405,
    `${patchCookieFlag.status}`,
  );
  if (patchGuest.status === 200 || patchCookieFlag.status === 200)
    check('اسم العرض: PATCH نجح أصلًا — المسار المتقاعد حيّ!', false, 'وصل 200');

  // ٩: الحدود الناجحة/الرفض مع حساب مبذور — على خادم محلي فقط، ولا كتابة إنتاج أبدًا
  if (!isLocalServer) {
    console.log(
      'ℹ️ PATCH الحدود الناجحة: محجوز للخادم المحلي — لا كتابة ضد النسخة الحية (مرر base محليًا).',
    );
  } else {
    const dbPath = path.join(process.cwd(), 'data', 'yemreact.sqlite');
    const token = randomUUID() + randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const userId = 'account-check-' + randomUUID();
    const db = new Database(dbPath);
    try {
      db.prepare(
        'INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',
      ).run(
        userId,
        'متحقق الحساب',
        `${userId}@account-check.invalid`,
        'x-not-used',
        'member',
        new Date().toISOString(),
      );
      db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES (?,?,?)').run(
        tokenHash,
        userId,
        Date.now() + 3600e3,
      );
      const session = `yr_session=${token}`;
      // الدفعة 3: حتى صاحب الجلسة الحقيقية يلقى 405 — لا طريق لتغيير اسم إطلاقًا
      const still405 = await call('/api/auth', {
        method: 'PATCH',
        cookie: session,
        body: JSON.stringify({ name: 'اسم بديل' }),
      });
      check(
        'PATCH مع جلسة حقيقية ⇒ 405 (الاسم غير قابل للتغيير بعد اليوم)',
        still405.status === 405,
        `${still405.status}`,
      );
      const me = await call('/api/auth', { cookie: session });
      check(
        'قراءة الجلسة تبقي الاسم الأصلي بلا أي مساس بعد المحاولة',
        me.status === 200 && JSON.parse(me.body).user?.name === 'متحقق الحساب',
      );
      const audit = db
        .prepare("SELECT COUNT(*) AS c FROM audit WHERE user_id=? AND action='profile.rename'")
        .get(userId).c;
      check('لا سطر تدقيقي profile.rename جديد بعد المحاولة', audit === 0, `audit=${audit}`);
      // ملاحظة معمارية صادقة: HTML الأول لصفحة الحساب يبدو زائري الشكل للجميع —
      // تعريف المالك يحدث داخل العميل عبر syncUser بعد التهيئة (لا SSR للجلسة).
      // لذا قيد «بيانات الحساب للمسجل الحقيقي فقط» يُثبت هنا على طبقة HTTP حيث
      // يُفرض فعلًا: فضاء محفوظات الخادم خاص بصاحب الجلسة وحده، ملغلق على الزائر.
      const mine = await call('/account', { cookie: session });
      check('GET /account بجلسة حقيقية — 200 حيّة', mine.status === 200, `${mine.status}`);
      const apiSavedOK = await call('/api/saved', { cookie: session });
      check(
        'خادم /api/saved بجلسة حقيقية ⇒ 200 (فضاء الحساب خاص بصاحبه)',
        apiSavedOK.status === 200,
        `${apiSavedOK.status}`,
      );
      const apiSavedGuest = await call('/api/saved', { cookie: guestCookie });
      check(
        'خادم /api/saved بكوكي yr_guest فقط ⇒ 401 (لا فضاء حساب للزائر — يبقى المحلي له)',
        apiSavedGuest.status === 401,
        `${apiSavedGuest.status}`,
      );
    } finally {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM audit WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      db.close();
    }
  }

  // ١٠: مصدر الرأس بلا أي ورقة حساب بعد اليوم، ووجهة الهاتف هي صفحة الحساب
  const headerSource = require('node:fs').readFileSync('src/components/Header.tsx', 'utf8');
  check(
    'مصدر Header: لا AccountSurface ولا accountSheet ولا Modal، ووجهة الهاتف /account',
    !/AccountSurface|accountSheet|ui\/Modal/.test(headerSource) &&
      /router\.push\('\/account'\)/.test(headerSource),
  );
  check(
    'مصدر Header: قائمة حاسوب محفوظة وزر إعداداتها رابط /settings',
    /<AccountActions/.test(headerSource) &&
      /<Link href="\/settings" onClick=\{dismiss\}>/.test(headerSource),
  );

  // ١٠ب: عقد أزرار الحساب (دفعة 2): الصورة رابط /account، والسهم عنصر مستقل
  // يملك عقد القائمة، وقائمة الزائر «تسجيل الدخول» ← /login بلا OAuth مباشر
  check(
    'مصدر Header: صورة الحساب رابط /account والسهم المجاور زر مستقل للقائمة',
    /<Link href="\/account" className="account-avatar"/.test(headerSource) &&
      /account-menu-trigger/.test(headerSource) &&
      (headerSource.match(/aria-haspopup/g) || []).length === 1,
  );
  check(
    'مصدر Header: قائمة الزائر بـ«تسجيل الدخول» ← /login — بلا OAuth مباشر وبلا «الاستمرار كزائر»',
    /<Link href="\/login" className="account-google-action" onClick=\{dismiss\}>/.test(
      headerSource,
    ) && !/api\/auth\/oauth\/|الاستمرار كزائر|account-google-pending/.test(headerSource),
  );

  // ١٠ز: عقد العدّادات (حسم حمدان 2026-10-18): بطاقة «المساهمات المنشورة» مخفية
  // مؤقتًا بلا بديلٍ مضلّل، والملخّص للمسجَّل الحقيقي فقط (mockSignedIn بلا أرقام)
  const surface = require('node:fs').readFileSync('src/components/AccountSurface.tsx', 'utf8');
  check(
    'مصدر السطح: «المالك»= app.user فقط، ولا بطاقة رقمية للمساهمات في الملخّص',
    /const owner = !!app\.user;/.test(surface) &&
      !/<b>\{contribution\.records\.length\}<\/b>/.test(surface) &&
      !/\{owner && \([\s\S]*?<span>مساهماتي<\/span>/m.test(
        surface.slice(surface.indexOf('account-summary'), surface.indexOf('account-actions-row')),
      ),
  );
  const cssPage = require('node:fs').readFileSync('src/app/navigation.css', 'utf8');
  check(
    'شبكة الملخّص عمودٌ واحد: بطاقة المحفوظات كاملة العرض بلا فراغ',
    /\.account-summary \{\s*display: grid;\s*grid-template-columns: 1fr;/.test(cssPage),
  );

  // ١١: كتلة أنماط سطح الحساب تتبع هوية الرمز — نصف قطر 9 وبلا خانة بنفسجية قديمة
  const css = cssPage;
  const surfaceStart = css.indexOf('سطح الحساب داخل صفحته');
  const surfaceBlock = css.slice(surfaceStart, css.indexOf('@media (min-width: 640px)'));
  check(
    'كتلة أنماط السطح قائمة بنصف قطر 9px وبلا بنفسجيات قديمة تحت نطاقها',
    surfaceStart >= 0 &&
      surfaceBlock.includes('.account-surface') &&
      surfaceBlock.includes('border-radius: 9px') &&
      !/(#7c3aed|#8b5cf6|#a855f7|purple)/i.test(surfaceBlock),
  );

  console.log(`\n${pass}/${pass + failures.length} ✅`);
  if (failures.length) {
    console.log('الفاشلة:', failures.join(' | '));
    process.exit(1);
  }
})().catch((error) => {
  console.error('تعذّر التحقق الحي:', error);
  process.exit(1);
});
