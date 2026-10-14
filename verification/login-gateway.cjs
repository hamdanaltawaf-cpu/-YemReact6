/*
 * البوّابة كما يراها المتصفح: بطاقات جاهزة حسب مفاتيح الخادم، بطاقة زائر
 * بوجهة مؤمَّنة، canonical للجذر، وnoindex — صدق البيئة بلا وعود مزيفة.
 * الاستخدام: node verification/login-gateway.cjs [base=http://localhost:3000]
 */
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
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
const html = async (path) => {
  const res = await fetch(base + path, {
    redirect: 'manual',
    headers: { 'user-agent': 'Mozilla/5.0 YemReactGatewayCheck/1.0', accept: 'text/html' },
  });
  return { res, body: await res.text() };
};
const count = (body, needle) => body.split(needle).length - 1;
/** عدد مزودي OAuth الجاهزين فعليًا وفق مفاتيح هذه البيئة (الخادم والسكربت يتشاركانها). */
const providers = ['google', 'apple', 'microsoft'];
const envReady = providers.filter(
  (p) => process.env[`OAUTH_${p.toUpperCase()}_CLIENT_ID`] && process.env[`OAUTH_${p.toUpperCase()}_CLIENT_SECRET`] && process.env.OAUTH_SITE_URL,
);

(async () => {
  // ١–٢: الجذر بوّابة HTML عربية
  const root = await html('/');
  check('الجذر — 200 للزائر', root.res.status === 200, `${root.res.status}`);
  check('HTML عربي RTL', /<html[^>]+dir="rtl"[^>]+lang="ar"|<html[^>]+lang="ar"[^>]+dir="rtl"/.test(root.body));

  // ٣–٥: بلا مفاتيح في هذه البيئة: ٣ بطاقات معلّقة، صفر روابط OAuth ميتة
  const pending = count(root.body, 'social-provider-pending');
  check(
    `البطاقات المعلّقة تطابق جاهزية المفاتيح (${providers.length - envReady.length} منتظَرة)`,
    pending === providers.length - envReady.length,
    `${pending}`,
  );
  const oauthLinks = count(root.body, '/api/auth/oauth/');
  check('لا روابط OAuth ميتة لخدمة بلا مفاتيح', oauthLinks === envReady.length, `${oauthLinks}`);
  const badges = count(root.body, 'social-provider-badge');
  check('شارة «قيد التجهيز» على كل بطاقة معلّقة', badges === pending && (pending === 0 || root.body.includes('قيد التجهيز')), `${badges}`);

  // ٦–٧: والبطاقات المعلّقة ليست روابط ولا وعودًا
  const disabled = count(root.body, 'aria-disabled="true"');
  check('البطاقات المعلّقة aria-disabled', disabled === pending, `${disabled}`);
  const note =
    pending === providers.length
      ? 'الدخول بالحساب قيد التجهيز — ويمكنك الاستمرار كزائر الآن'
      : pending > 0
        ? 'الدخول متاح عبر الخدمات المفعّلة أعلاه'
        : '';
  check('ملاحظة الجاهزية صادقة بحسب العدد', pending === 0 || root.body.includes(note), note || 'كلها جاهزة');

  // ٨–١٠: بطاقة الزائر قرار واضح ووجهتها مؤمَّنة
  check('بطاقة الزائر حاضرة وتفضي إلى /library', /class="social-guest-card"[^>]*href="\/library"|href="\/library"[^>]*class="social-guest-card"/.test(root.body));
  check('نصّها صادق: بلا حساب، والحفظ على الجهاز', root.body.includes('بلا حساب. وما تحفظه يبقى على هذا الجهاز.'));
  check('لها تسمية وصول واضحة', root.body.includes('aria-label="الاستمرار كزائر بلا حساب"'));

  // ١١–١٣: canonical وnoindex وهوية الصفحة
  const canonical = root.body.match(/<link rel="canonical" href="([^"]+)"/);
  check('canonical للجذر هو الجذر نفسه', !!canonical && new URL(canonical[1]).pathname === '/', canonical ? canonical[1] : 'غائب');
  const robots = root.body.match(/<meta name="robots" content="([^"]+)"/);
  check('البوّابة noindex مع follow', !!robots && /noindex/.test(robots[1]) && /follow/.test(robots[1]), robots ? robots[1] : 'غائب');
  check('هيئة الدخول قصة + لوحة (social-auth/auth-story)', root.body.includes('social-auth') && root.body.includes('auth-story'));

  // ١٤–١٦: /?q= يبقى سطح البحث (سلوك البوّابة لا يكسر المكتبة)
  const search = await fetch(base + '/?q=' + encodeURIComponent('يا ساتر'), { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 YemReactGatewayCheck/1.0', accept: 'text/html' } });
  const location = search.headers.get('location');
  check(
    '/?q= يحيل إلى /library مع q محفوظًا',
    [301, 302, 303, 307, 308].includes(search.status) && location && new URL(location, base).pathname === '/library' && new URL(location, base).searchParams.get('q') === 'يا ساتر',
    `${search.status} → ${location || '-'}`,
  );
  const emptyQ = await fetch(base + '/?q=', { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 YemReactGatewayCheck/1.0', accept: 'text/html' } });
  check('/?q= الفارغة تبقى على البوّابة (لا إحالة وهمية)', emptyQ.status === 200, `${emptyQ.status}`);
  const followSearch = await fetch(base + '/library?q=' + encodeURIComponent('يا ساتر'), { headers: { 'user-agent': 'Googlebot', accept: 'text/html' } });
  const followBody = await followSearch.text();
  check('سطح المكتبة للزاحف يحمل قيمة البحث في واجهته', followSearch.status === 200 && followBody.includes('يا ساتر'), `${followSearch.status}`);

  // ١٧–١٨: /login يشارك الصفحة ويحترم next الآمن
  const loginSaved = await html('/login?next=' + encodeURIComponent('/saved?tab=clips'));
  check('/login?next آمن ينعكس على بطاقة الزائر', /href="\/saved\?tab=clips"[^>]*class="social-guest-card"|class="social-guest-card"[^>]*href="\/saved\?tab=clips"/.test(loginSaved.body));
  const loginHostile = await html('/login?next=' + encodeURIComponent('https://evil.example/steal'));
  check('/login?next خارجي يعود إلى /library', /class="social-guest-card"[^>]*href="\/library"|href="\/library"[^>]*class="social-guest-card"/.test(loginHostile.body));

  console.log(`\nlogin-gateway: ${pass}/18 ${failures.length ? '— فاشل: ' + failures.join(' | ') : '— كل الفحوصات نجحت'}`);
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error('انكسر التحقق:', error);
  process.exit(1);
});
