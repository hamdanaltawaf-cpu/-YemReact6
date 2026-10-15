/*
 * بوّابة الدخول شاشة قائمة بذاتها: لا رأس ولا فوتر ولا شريط سفلي على «/» و«/login»
 * وبقية الأسطح تحتفظ بواجهتها. تحقّق على HTML المخدوم (SSR — بلا وميض بعد التركيب).
 * الاستخدام: node verification/login-chrome.cjs [base=http://localhost:3000]
 */
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) YemReactChromeCheck/1.0';
let pass = 0;
const failures = [];
function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`✓ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failures.push(label);
    console.log(`✗ ${label}${detail ? ' — ' + detail : ''}`);
  }
}
async function page(path, cookie = '') {
  const headers = { 'user-agent': UA, accept: 'text/html' };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(base + path, { redirect: 'manual', headers });
  return { status: res.status, body: await res.text() };
}
const has = (body, needle) => body.includes(needle);

(async () => {
  // ١–٤: الجذر للزائر — بلا رأس ولا فوتر ولا شريط سفلي، وتبقى بطاقة الدخول
  const root = await page('/');
  check('«/» بلا كوكي: 200', root.status === 200, `${root.status}`);
  check('«/» بلا site-header', !has(root.body, 'class="site-header"'));
  check('«/» بلا glass-nav', !has(root.body, 'glass-nav'));
  check('«/» بلا site-footer', !has(root.body, 'class="site-footer"'));
  check('«/» يبقي social-guest-card', has(root.body, 'social-guest-card'));

  // ٥–٧: /login — السطح نفسه بلا واجهة الموقع (بما فيها الوصول عبر next)
  const login = await page('/login');
  check('«/login»: بلا site-header', !has(login.body, 'class="site-header"'));
  check('«/login»: بلا glass-nav', !has(login.body, 'glass-nav'));
  const loginNext = await page('/login?next=' + encodeURIComponent('/saved'));
  check('«/login?next=»: بلا site-header أيضًا', !has(loginNext.body, 'class="site-header"'));

  // ٨–١٠: /library بكوكي الزائر — واجهة الموقع كاملة كما كانت
  const library = await page('/library', 'yr_guest=1');
  check('«/library» بكوكي yr_guest=1: 200', library.status === 200, `${library.status}`);
  check('«/library»: يوجد site-header', has(library.body, 'class="site-header"'));
  check('«/library»: يوجد glass-nav', has(library.body, 'glass-nav'));

  // ١١–١٤: بقية الأسطح تحتفظ بواجهتها
  const help = await page('/help');
  check('«/help»: يوجد site-header', has(help.body, 'class="site-header"'));
  const privacy = await page('/privacy');
  check('«/privacy»: يوجد site-header', has(privacy.body, 'class="site-header"'));
  const offline = await page('/offline');
  check('«/offline»: يوجد site-header', has(offline.body, 'class="site-header"'));
  const helpFooter = has(help.body, 'class="site-footer"');
  check('«/help»: يبقي الفوتر كما تعوّد', helpFooter);

  console.log(
    `\nlogin-chrome: ${pass}/${pass + failures.length} ${failures.length ? '— ✗: ' + failures.join(' | ') : '— كل الفحوصات نجحت'}`,
  );
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error('انكسر التحقق:', error);
  process.exit(1);
});
