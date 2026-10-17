/*
 * صفحة الحساب حيًّا: رأس عام نظيف من زرّي «إرسال رياكشن/الإعدادات»، لا صفحات
 * ملفات عامة، وجهة النشر ووجهة «مساهماتي» القائمتان تعملان، وPATCH /api/auth
 * يحدّث اسم العرض بتحقق حدود ولا يلمسه لغير صاحب الجلسة.
 * الاستخدام: node verification/account-page.cjs [base=http://localhost:3000]
 */
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const Database = require('better-sqlite3');

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 YemReactAccountCheck/1.0';
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
    'referer': base + '/library',
    ...headers,
  };
  if (cookie) merged.cookie = cookie;
  if (body) merged['content-type'] = 'application/json';
  const res = await fetch(base + urlPath, { method, redirect: 'manual', headers: merged, body });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text, location: res.headers.get('location') };
}
const headerSlice = (html) => {
  const start = html.indexOf('<header class="site-header"');
  const end = html.indexOf('</header>', start);
  return start >= 0 && end > start ? html.slice(start, end) : '';
};

(async () => {
  await call('/api/auth'); // يضمن تهيئة قاعدة البيانات قبل أي بذر
  const guestCookie = 'yr_guest=1';

  // ١–٢: الرأس العام (التقديم الأول من الخادم) خالٍ من تحرير الحساب والنشر
  const library = await call('/library', { cookie: guestCookie });
  check('GET /library للزائر — 200', library.status === 200, `${library.status}`);
  const header = headerSlice(library.body);
  check('شريط الرأس موجود وبنية الصف كما كانت', /header-row/.test(header) && /library-search/.test(header));
  check(
    'لا زر «إرسال رياكشن» ولا «الإعدادات» ولا «تحرير الهوية» في شريط الرأس العام',
    !/إرسال رياكشن|الإعدادات|تحرير الهوية/.test(header),
  );
  // ٤: الشريط السفلي الزجاجي لم يتبدّل: خمسة ألسنة ومنها «الحساب»
  const glass = library.body.match(/<nav class="glass-nav"[\s\S]*?<\/nav>/);
  check(
    'الشريط السفلي قائم بألسنته الخمسة وزر الحساب ضمنها',
    !!glass &&
      (glass[0].match(/class="gnav-/g) || []).length >= 5 &&
      /الحساب/.test(glass[0]),
    glass ? `${(glass[0].match(/class="gnav-/g) || []).length} ألسنة` : 'مفقود',
  );

  // ٥–٦: لا ملفات شخصية عامة
  for (const path404 of ['/account', '/account/profile', '/u/ay-one']) {
    const r = await call(path404, { cookie: guestCookie });
    check(`${path404} ⇒ 404 — لا ملفات عامة`, r.status === 404, `${r.status}`);
  }

  // ٧–٨: وجهتا النشر و«مساهماتي» القائمتان تعملان
  const contribute = await call('/contribute', { cookie: guestCookie });
  check('وجهة النشر /contribute — 200', contribute.status === 200, `${contribute.status}`);
  const subs = await call('/account/submissions', { cookie: guestCookie });
  check('وجهة «مساهماتي» القائمة /account/submissions — 200', subs.status === 200, `${subs.status}`);

  // ٩–١٠: PATCH مقفل أمام من لا جلسة حقيقية له
  const patchGuest = await call('/api/auth', {
    method: 'PATCH',
    body: JSON.stringify({ name: 'زائر متلصص' }),
  });
  check('PATCH بلا جلسة ⇒ 401', patchGuest.status === 401, `${patchGuest.status}`);
  const patchCookieFlag = await call('/api/auth', {
    method: 'PATCH',
    cookie: guestCookie,
    body: JSON.stringify({ name: 'زائر بعلم' }),
  });
  check('PATCH بكوكي yr_guest فقط (لا جلسة) ⇒ 401', patchCookieFlag.status === 401, `${patchCookieFlag.status}`);
  if (patchGuest.status === 200 || patchCookieFlag.status === 200)
    check('اسم العرض: زائر نجح بالتعديل (انسكاب أمني!)', false, 'وصل 200 بلا جلسة');

  // ١١–١٣: جلسة حقيقية مبذورة: حدود الاسم + نجاح التحديث ومزامنته
  const dbPath = path.join(process.cwd(), 'data', 'yemreact.sqlite');
  const token = randomUUID() + randomUUID();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const userId = 'account-check-' + randomUUID();
  const db = new Database(dbPath);
  try {
    db.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(
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
    const tooShort = await call('/api/auth', { method: 'PATCH', cookie: session, body: JSON.stringify({ name: 'ن' }) });
    check('اسم من حرف واحد ⇒ 400', tooShort.status === 400, `${tooShort.status}`);
    const tooLong = await call('/api/auth', { method: 'PATCH', cookie: session, body: JSON.stringify({ name: 'أ'.repeat(41) }) });
    check('اسم فوق 40 حرفًا ⇒ 400', tooLong.status === 400, `${tooLong.status}`);
    const ok = await call('/api/auth', {
      method: 'PATCH',
      cookie: session,
      body: JSON.stringify({ name: '  حمدان   التواف  ' }),
    });
    check('اسم نظيف مع حشوات يتقص ويُقبل ⇒ 200 محفوظ', ok.status === 200 && JSON.parse(ok.body).user?.name === 'حمدان التواف', `${ok.status}`);
    const me = await call('/api/auth', { cookie: session });
    check('قراءة الجلسة بعد الحفظ تعيد الاسم الجديد المحفوظ', me.status === 200 && JSON.parse(me.body).user?.name === 'حمدان التواف');
    const audit = db.prepare("SELECT COUNT(*) AS c FROM audit WHERE user_id=? AND action='profile.rename'").get(userId).c;
    check('السجل التدقيقي يوثّق تغيير الاسم', audit >= 1, `audit=${audit}`);
  } finally {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM audit WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    db.close();
  }

  // ١٤: كتلة أنماط سطح الحساب تتبع هوية الرمز — نصف قطر 9 وبلا خانة بنفسجية قديمة
  const css = require('node:fs').readFileSync('src/app/navigation.css', 'utf8');
  const surfaceBlock = css.slice(css.indexOf('سطح الحساب'), css.indexOf('@media (min-width: 640px)'));
  check(
    'كتلة أنماط السطح قائمة بنصف قطر 9px وبلا بنفسجيات قديمة تحت نطاقها',
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
