/*
 * صدق جاهزية مزودي الدخول: مصفوفة قرار oauthConfig على مصفوفة بيئات،
 * والتحقق أن HTML البوّابة لا يسرّب مفاتيح ولا يعرض روابط لخدمة بلا مفاتيح.
 * الاستخدام: node verification/login-social.cjs [base=http://localhost:3000]
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

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
function load(file, overrides) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => (name in overrides ? overrides[name] : require(name)),
      URL,
      process,
    },
  );
  return module.exports;
}
const social = (() => {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/lib/social.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports },
  );
  return exports;
})();
const { oauthConfig } = load(path.join('src', 'server', 'oauth-config.ts'), {
  'server-only': {},
  '@/lib/social': social,
});

const creds = (provider, extra = {}) => ({
  [`OAUTH_${provider.toUpperCase()}_CLIENT_ID`]: 'id-' + provider,
  [`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET`]: 'secret-' + provider,
  ...extra,
});
const HTTPS_SITE = { OAUTH_SITE_URL: 'https://yemreact.example' };
const LOCAL_SITE = { OAUTH_SITE_URL: 'http://localhost:3000' };

(async () => {
  // ١–٣: بيئة فارغة ⇒ لا مزوّد جاهز
  for (const provider of ['google', 'apple', 'microsoft'])
    check(`بيئة فارغة: ${provider} غير جاهز`, oauthConfig(provider, {}) === null);

  // ٤–٦: مفاتيح كاملة عبر https ⇒ جاهز
  check('google بمفاتيحه الكاملة جاهز على https', oauthConfig('google', { ...creds('google'), ...HTTPS_SITE })?.origin === 'https://yemreact.example');
  check('apple بمفاتيح الكاملة جاهز على https', oauthConfig('apple', { ...creds('apple'), ...HTTPS_SITE })?.issuer === 'https://appleid.apple.com');
  check('microsoft بمفاتيحه الكاملة جاهز على https (tenant افتراضي common)', oauthConfig('microsoft', { ...creds('microsoft'), ...HTTPS_SITE })?.tenant === 'common');

  // ٧–١٠: سياسة localhost — apple لا يقبل محليًا حتى خارج الإنتاج
  check('google يقبل http://localhost خارج الإنتاج', !!oauthConfig('google', { ...creds('google'), ...LOCAL_SITE }));
  check('microsoft يقبل http://localhost خارج الإنتاج', !!oauthConfig('microsoft', { ...creds('microsoft'), ...LOCAL_SITE }));
  check('apple يرفض localhost للتطوير', oauthConfig('apple', { ...creds('apple'), ...LOCAL_SITE }) === null);
  check('google على http خارج الإنتاج مع NODE_ENV=production مرفوض', oauthConfig('google', { ...creds('google'), ...LOCAL_SITE, NODE_ENV: 'production' }) === null);

  // ١١–١٣: أمان التهيئة — معرّف بلا سرّ، مسارٌ في الموقع، اعتماداتٌ مضمَّنة
  check(
    'معرّف بلا سرّ ⇒ غير جاهز',
    oauthConfig('google', { OAUTH_GOOGLE_CLIENT_ID: 'id', OAUTH_SITE_URL: 'https://yemreact.example' }) === null,
  );
  check(
    'OAUTH_SITE_URL مع مسار مرفوض',
    oauthConfig('google', { ...creds('google'), OAUTH_SITE_URL: 'https://yemreact.example/app' }) === null,
  );
  check(
    'OAUTH_SITE_URL مع اعتمادات مضمّنة مرفوض',
    oauthConfig('google', { ...creds('google'), OAUTH_SITE_URL: 'https://u:p@yemreact.example' }) === null,
  );

  // ١٤–١٥: tenant مايكروسوفت يتحقق من قيمته
  check('tenant مايكروسوفت بقيمة غريبة مرفوض', oauthConfig('microsoft', { ...creds('microsoft'), ...HTTPS_SITE, OAUTH_MICROSOFT_TENANT_ID: 'evil-tenant' }) === null);
  check(
    'tenant UUID مقبول',
    oauthConfig('microsoft', { ...creds('microsoft'), ...HTTPS_SITE, OAUTH_MICROSOFT_TENANT_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })?.redirectUri === 'https://yemreact.example/api/auth/oauth/microsoft/callback',
  );

  // ١٦–١٨: HTML البوّابة الحيّ لا يسرّب أسرارًا ولا يقدّم روابط ميتة
  const login = await fetch(base + '/login', { headers: { 'user-agent': 'Mozilla/5.0 YemReactSocialCheck/1.0', accept: 'text/html' } });
  const body = await login.text();
  check('/login لا يذكر أسماء متغيّرات الأسرار', !/OAUTH_[A-Z]+/.test(body));
  const leaks = Object.entries(process.env).filter(
    ([key, value]) => key.startsWith('OAUTH_') && value && body.includes(value),
  );
  check('قِيَم متغيّرات OAUTH_* الفعلية غائبة تمامًا عن HTML', leaks.length === 0, leaks.map(([k]) => k).join(',') || 'نظيف');
  const ready = ['google', 'apple', 'microsoft'].filter((p) => oauthConfig(p));
  const deadLinks = (body.match(/\/api\/auth\/oauth\/(google|apple|microsoft)"/g) || []).length - ready.length;
  check('عدد روابط OAuth في الصفحة = عدد الجاهزين بالضبط', deadLinks === 0, `جاهز: ${ready.length}`);

  console.log(`\nlogin-social: ${pass}/18 ${failures.length ? '— فاشل: ' + failures.join(' | ') : '— كل الفحوصات نجحت'}`);
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error('انكسر التحقق:', error);
  process.exit(1);
});
