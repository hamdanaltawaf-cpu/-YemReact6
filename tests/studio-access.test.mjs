import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, overrides, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => (name in overrides ? overrides[name] : require(name)),
      ...globals,
    },
  );
  return module.exports;
}
function pageFor(user) {
  const Admin = () => null;
  const page = load('src/app/admin/page.tsx', {
    '@/features/Admin': { __esModule: true, default: Admin },
    '@/server/auth': { currentUser: async () => user },
    'next/navigation': {
      redirect: (to) => {
        throw Object.assign(new Error('redirect'), { to });
      },
      notFound: () => {
        throw new Error('not-found');
      },
    },
  });
  return { Page: page.default, Admin, dynamic: page.dynamic };
}
test('Studio redirects unauthenticated visitors before rendering', async () => {
  const { Page, dynamic } = pageFor(null);
  assert.equal(dynamic, 'force-dynamic');
  await assert.rejects(Page(), (error) => error.message === 'redirect' && error.to === '/login');
});
test('Studio denies non-admin roles on the server', async () => {
  for (const role of ['member', 'owner', '', undefined]) {
    await assert.rejects(pageFor({ role }).Page(), /not-found/);
  }
});
test('Studio renders for an authenticated admin', async () => {
  const { Page, Admin } = pageFor({ role: 'admin' });
  assert.equal((await Page()).type, Admin);
});
function navigation(
  user,
  { popoverOpen = false, mockSignedIn = false, googleAuthOrigin = '', readyProviders = [] } = {},
) {
  let states = 0;
  const pushes = [];
  let glassSelect = () => {};
  let headerInstance = null;
  const overrides = {
    react: {
      ...React,
      useState: (initial) => {
        const index = states++;
        return React.useState(index === 0 ? popoverOpen : initial);
      },
    },
    'next/navigation': {
      usePathname: () => '/collections',
      useRouter: () => ({ push: (to) => pushes.push(to), replace: () => {} }),
    },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    './AppProvider': {
      // الحد الأدنى المستخدم فعليًا عند تقديم قائمة الحساب (بلا أحداث)
      useApp: () => ({ user, authReady: true, reactions: [], saved: [], reduced: false }),
    },
    './ContributionProvider': {
      useContribution: () => ({ mockSignedIn, records: [], endMockSession: () => {} }),
    },
    './glass-nav/GlassNav': {
      // الشريط الزجاجي مكوّن عميل مستقل — نبديله بعقد يحفظ onSelect لاختبار قدرة
      // تبويب «الحساب» السلوكية (خصوصًا انتقال الهاتف إلى صفحة الحساب الكاملة)
      GlassNav: ({ onSelect }) => {
        glassSelect = onSelect;
        return React.createElement(
          'nav',
          { className: 'glass-nav', 'aria-label': 'التنقل الرئيسي' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'mobile-account-tab',
              onClick: () => onSelect?.('account'),
            },
            'الحساب',
          ),
        );
      },
    },
    './Qusasa': { Qusasa: () => null },
    './SocialIcon': { SocialIcon: () => null },
    // بديل مطابق لعقد src/lib/chrome.ts (مسارا البوّابة فقط)
    '@/lib/chrome': { isGatewayPath: (p) => p === '/' || p === '/login' },
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  // نافذة مشتركة قابلة للتحكيم يقرأها المكوّن داخل الـ vm (matchMedia قابل للتبديل)
  const sharedWindow = { matchMedia: () => ({ matches: false }) };
  const { Header } = load('src/components/Header.tsx', overrides, { window: sharedWindow });
  const { Footer } = load('src/components/Footer.tsx', overrides, { window: sharedWindow });
  headerInstance = React.createElement(Header, { googleAuthOrigin, readyProviders });
  return {
    header: renderToStaticMarkup(headerInstance),
    footer: renderToStaticMarkup(React.createElement(Footer)),
    pushes,
    selectAccount: (desktopWidth) => {
      sharedWindow.matchMedia = (query) => ({
        matches: desktopWidth && query.includes('1024px'),
      });
      glassSelect('account');
    },
  };
}
test('Account menu: desktop popover; on the phone the account button navigates to the full /account page — no sheet anywhere', () => {
  const { header } = navigation(null, { popoverOpen: true });
  assert.match(header, /<button[^>]*class="account-avatar"[^>]*aria-haspopup="dialog"/);
  assert.match(header, /role="dialog" aria-label="قائمة الحساب"/);
  assert.match(header, /أنت زائر/);
  // الهاتف (أقل من 1024px): تبويب «الحساب» يفتح الصفحة الكاملة
  const phone = navigation(null);
  phone.selectAccount(false);
  assert.deepEqual(phone.pushes, ['/account']);
  // الحاسوب: التبديل يبقى داخل القائمة — لا انتقال للصفحة ولا ورقة هاتف
  const desktop = navigation(null);
  desktop.selectAccount(true);
  assert.deepEqual(desktop.pushes, []);
  assert.doesNotMatch(
    fs.readFileSync('src/components/Header.tsx', 'utf8'),
    /accountSheet|AccountSurface|<Modal/,
  );
});
test('Guest shows real Google entry, settings and help without a signed-in identity', () => {
  const { header, footer } = navigation(null, {
    popoverOpen: true,
    googleAuthOrigin: 'https://example.test',
    readyProviders: ['google'],
  });
  assert.match(header, /سجّل لحفظ رياكشناتك/);
  assert.match(header, /والوصول من أي جهاز/);
  assert.match(
    header,
    /href="https:\/\/example\.test\/api\/auth\/oauth\/google"[^>]*>.*الدخول بـ Google/,
  );
  for (const item of ['الإعدادات', 'المساعدة']) assert.match(header, new RegExp(item));
  assert.doesNotMatch(header + footer, /href="\/admin"|الاستوديو|تسجيل الخروج|ADMIN/);
  assert.doesNotMatch(header, /href="\/login"|account-profile-email/);
});
test('Keyless guest sees a pending sign-in entry that goes to /login, never a dead OAuth URL', () => {
  const { header } = navigation(null, { popoverOpen: true });
  assert.match(header, /href="\/login"[^>]*class="account-google-action account-google-pending"/);
  assert.match(header, /account-pending-chip">قيد التجهيز/);
  assert.doesNotMatch(header, /href="[^"]*\/api\/auth\/oauth\/google"/);
});
test('Real member: popover shows avatar, name, email, settings (→/settings), help and logout only', () => {
  const user = { role: 'member', name: 'عضو تجريبي', email: 'member@example.test' };
  const { header, footer } = navigation(user, { popoverOpen: true });
  for (const item of [user.name, user.email, 'الإعدادات', 'المساعدة', 'تسجيل الخروج'])
    assert.match(header, new RegExp(item));
  assert.match(header, /class="account-profile-avatar"/);
  // قرار عام: زر الإعدادات رابط مباشر لصفحة /settings من القائمة أيضًا (لا نافذة)
  assert.match(header, /<a href="\/settings"[^>]*>.*الإعدادات/);
  assert.doesNotMatch(header + footer, /href="\/admin"|الاستوديو|>ADMIN<|الدخول بـ Google/);
  assert.doesNotMatch(header, /setSettings/);
});
test('Only real admins see the Studio entry and ADMIN badge in their account menu', () => {
  const admin = { role: 'admin', name: 'مديرة المكتبة', email: 'admin@example.test' };
  const closed = navigation(admin);
  assert.doesNotMatch(closed.header, /href="\/admin"/);
  assert.match(closed.footer, /href="\/admin"/);
  const { header } = navigation(admin, { popoverOpen: true });
  for (const item of [admin.name, admin.email, 'الإعدادات', 'المساعدة', 'تسجيل الخروج'])
    assert.match(header, new RegExp(item));
  assert.match(header, /class="account-role-badge">ADMIN<\/span>/);
  assert.match(header, /href="\/admin"[^>]*>.*الاستوديو/);
  // ترتيب «الاستوديو قبل الإعدادات» عقدُ قائمة الحاسوب تبقى كما هي دون لمس
  assert.ok(header.indexOf('الاستوديو') < header.indexOf('الإعدادات'));
  assert.doesNotMatch(header, /الدخول بـ Google/);
  const account = fs.readFileSync('src/features/Auth.tsx', 'utf8');
  assert.match(account, /app\.user\.role === 'admin' \? '\/admin' : '\/saved'/);
});
test('Mock contribution sign-in remains a guest, with its own session-end action', () => {
  const { header, footer } = navigation(null, {
    popoverOpen: true,
    mockSignedIn: true,
    readyProviders: ['google'],
  });
  assert.match(header, /أنت زائر/);
  assert.match(header, /إنهاء جلسة التجربة/);
  assert.match(header, /href="\/api\/auth\/oauth\/google"/);
  assert.doesNotMatch(header + footer, /href="\/admin"|الاستوديو|>ADMIN<|تسجيل الخروج/);
  assert.match(fs.readFileSync('src/components/Header.tsx', 'utf8'), /await app\.logout\(\)/);
});
