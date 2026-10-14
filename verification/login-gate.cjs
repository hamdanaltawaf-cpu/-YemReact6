/*
 * بوّابة الدخول حيًّا: من يدخل بلا جلسة يُحال إلى /login?next=… (307 مؤقتة)،
 * والمسجَّل/الزائر المختار/الزاحف/الجلب المسبق يمرّون بلا حبس.
 * الاستخدام: node verification/login-gate.cjs [base=http://localhost:3000]
 */
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 YemReactGateCheck/1.0';
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
async function get(urlPath, { ua = BROWSER_UA, accept = HTML_ACCEPT, cookie = '', headers = {}, method = 'GET' } = {}) {
  const merged = { 'user-agent': ua, accept, ...headers };
  if (cookie) merged.cookie = cookie;
  const res = await fetch(base + urlPath, { method, redirect: 'manual', headers: merged });
  const location = res.headers.get('location');
  return { status: res.status, location: location ? new URL(location, base) : null, res };
}
const isLoginGate = (r, next) =>
  r.status === 307 &&
  r.location &&
  r.location.pathname === '/login' &&
  (!next || decodeURIComponent(r.location.searchParams.get('next') || '') === next);

(async () => {
  // ١–٥: صفحات المحتوى بلا كوكيز تنحاز للبوّابة مع وجهتها محفوظة
  const library = await get('/library');
  check('زائر بلا كوكيز على /library ⇒ 307 إلى /login مع next', isLoginGate(library, '/library'), `${library.status}`);
  const libraryQ = await get('/library?q=' + encodeURIComponent('أهل'));
  check('/library?q= يحفظ الوجهة كاملة في next', isLoginGate(libraryQ, '/library?q=أهل'));
  const saved = await get('/saved');
  check('زائر على /saved ⇒ بوّابة مع next', isLoginGate(saved, '/saved'));
  const collections = await get('/collections');
  check('زائر على /collections ⇒ بوّابة مع next', isLoginGate(collections, '/collections'));
  const deep = await get('/collections/المقاطع-الأولى');
  check('زائر على مسار عميق ⇒ بوّابة مع next عميق', isLoginGate(deep, '/collections/المقاطع-الأولى'));

  // ٦–٩: المسارات المفتوحة لا تُحبس
  for (const openPath of ['/login', '/help', '/privacy', '/offline']) {
    const open = await get(openPath);
    check(`${openPath} مفتوح للجميع — 200 بلا إحالة`, open.status === 200, `${open.status}`);
  }

  // ١٠–١٣: الزواحف والمعاينات تصل للمحتوى مباشرة
  const crawlers = [
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['فيسبوك', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['واتساب', 'WhatsApp/2.23.20.0 A'],
    ['ديسكورد', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
  ];
  for (const [name, ua] of crawlers) {
    const crawler = await get('/library', { ua });
    check(`زاحف ${name} يمرّ بلا حبس — 200`, crawler.status === 200, `${crawler.status}`);
  }

  // ١٤: طلب بلا Accept: HTML ليس تنقّلًا بشريًا
  const nonHtml = await get('/library', { accept: '*/*', ua: 'SomeNativeApp/3.1' });
  check('طلب بلا Accept: HTML لا يُحال', nonHtml.status !== 307 || (nonHtml.location && nonHtml.location.pathname !== '/login'), `${nonHtml.status}`);

  // ١٥: كوكي الزائر يفتح المكتبة
  const guest = await get('/library', { cookie: 'yr_guest=1' });
  check('اختيار «الاستمرار كزائر» (yr_guest=1) يفتح /library — 200', guest.status === 200, `${guest.status}`);

  // ١٦: الجذر زائرًا يعرض البوّابة نفسها (لا إحالة حلزونية)
  const root = await get('/');
  check('الجذر للزائر — 200 بوّابة مباشرة', root.status === 200, `${root.status}`);
  const rootBody = await root.res.text();
  check('البوّابة تقدّم بطاقات الدخول فعلًا', rootBody.includes('social-provider'));

  // ١٧: الجذر مع q يبقى سطح المكتبة حتى للزائر (البحث حالة من المكتبة)
  const rootQ = await get('/?q=' + encodeURIComponent('برامج'));
  check(
    '/?q= يتجاوز البوّابة إلى /library مع q محفوظًا',
    [301, 302, 303, 307, 308].includes(rootQ.status) &&
      rootQ.location &&
      rootQ.location.pathname === '/library' &&
      rootQ.location.searchParams.get('q') === 'برامج',
    `${rootQ.status} → ${rootQ.location ? rootQ.location.pathname + rootQ.location.search : '-'}`,
  );

  // ١٨: طلب RSC لا يُكسَّر ولا يُحال: طبقة Next تعالج ترويسته ومعامله قبل Middleware،
  // لذا يصل كطلب بلا Accept: HTML — والبوّابة تمرّره لمحرك الصفحة (فرع الحبس مغطى وحدةً في decideGate)
  const rsc = await get('/library?_rsc=g4t3', { accept: 'text/x-component' });
  check('طلب RSC (text/x-component) يمرّ بلا إحالة ولا كسر — 200', rsc.status === 200, `${rsc.status}`);

  // ١٩: الجلب المسبق لا يُجاب بإحالة (purpose هو ما يصل فعلًا بعد معالجة Next للترويسات)
  const prefetch = await get('/library', { headers: { purpose: 'prefetch' } });
  check('جلب مسبق purpose=prefetch لا يُحال', prefetch.status !== 307 || (prefetch.location && prefetch.location.pathname !== '/login'), `${prefetch.status}`);

  // ٢٠: أثر POST لا يمرّ عبر البوّابة
  const post = await get('/library', { method: 'POST' });
  check('POST لا يُحال إلى /login', !(post.status === 307 && post.location && post.location.pathname === '/login'), `${post.status}`);

  // ٢١: كوكي جلسة عشوائي: البوّابة تمرّره للصفحة، والخادم يرفضه كزائر عند الفحص الحقيقي
  const junk = await get('/', { cookie: 'yr_session=junk-not-a-real-token' });
  check('كوكي جلسة ملفّق على الجذر — 200 (البوّابة تعرض نفسها بلا كسر)', junk.status === 200, `${junk.status}`);

  // ٢٢–٢٤: /login وعلاقته بالوجهة المسمومة
  const login = await get('/login');
  check('/login — 200 وmeta noindex', login.status === 200);
  const loginBody = await login.res.text();
  check('/login يعلن noindex', /name="robots" content="noindex/.test(loginBody) || /noindex/.test(loginBody.match(/<meta[^>]+robots[^>]*>/)?.[0] || ''));
  const hostile = await get('/login?next=//evil.example/steal');
  const hostileBody = await hostile.res.text();
  check('next معادٍ (//host) يعاد تأمينه: بطاقة الزائر تفضي إلى /library', /class="social-guest-card"[^>]*href="\/library"|href="\/library"[^>]*class="social-guest-card"/.test(hostileBody));

  // ٢٥–٢٩: جلسة حقيقية مزروعة في SQLite
  const Database = require('better-sqlite3');
  const dbPath = path.join(process.cwd(), 'data', 'yemreact.sqlite');
  const token = randomUUID() + randomUUID();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const userId = 'gate-check-' + randomUUID();
  const db = new Database(dbPath);
  try {
    db.prepare(
      'INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',
    ).run(userId, 'متحقّق البوّابة', `${userId}@gate-check.invalid`, 'x-not-used', 'member', new Date().toISOString());
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES (?,?,?)').run(
      tokenHash,
      userId,
      Date.now() + 3600e3,
    );
    const sessionCookie = `yr_session=${token}`;
    const signedLibrary = await get('/library', { cookie: sessionCookie });
    check('جلسة حقيقية تفتح /library — 200', signedLibrary.status === 200, `${signedLibrary.status}`);
    const signedRoot = await get('/', { cookie: sessionCookie });
    check(
      'المسجَّل على الجذر يُحال فورًا إلى /library — لا يرى البوّابة',
      [301, 302, 303, 307, 308].includes(signedRoot.status) &&
        signedRoot.location &&
        signedRoot.location.pathname === '/library',
      `${signedRoot.status} → ${signedRoot.location ? signedRoot.location.pathname : '-'}`,
    );
    const signedRootQ = await get('/?q=' + encodeURIComponent('خبر'), { cookie: sessionCookie });
    check(
      'المسجَّل مع q يصل للمكتبة مع q',
      [301, 302, 303, 307, 308].includes(signedRootQ.status) &&
        signedRootQ.location &&
        signedRootQ.location.pathname === '/library' &&
        signedRootQ.location.searchParams.get('q') === 'خبر',
    );
    const expired = await get('/library', { cookie: 'yr_guest=1; yr_session=' + token }, { ua: 'Wget/1.21' });
    check('متوافق الزاحف + كوكيز معًا ما زال يمرّ (لا تفضيل أعمى)', expired.status === 200);
    const detail = await get('/r/sh-' + randomUUID().slice(0, 8), { cookie: sessionCookie });
    check('مسار مشاركة /r/* لا يُحبس للمسجَّل', detail.status !== 307 || (detail.location && detail.location.pathname !== '/login'), `${detail.status}`);
  } finally {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    db.close();
  }

  console.log(`\nlogin-gate: ${pass}/${pass + failures.length} ${failures.length ? '— فاشل: ' + failures.join(' | ') : '— كل الفحوصات نجحت'}`);
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error('انكسر التحقق:', error);
  process.exit(1);
});
