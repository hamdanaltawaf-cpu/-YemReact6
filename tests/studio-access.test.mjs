import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, overrides) {
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
  { popoverOpen = false, sheetOpen = false, mockSignedIn = false, googleAuthOrigin = '' } = {},
) {
  let states = 0;
  const overrides = {
    react: {
      ...React,
      useState: (initial) => {
        const index = states++;
        return React.useState(index === 0 ? popoverOpen : index === 1 ? sheetOpen : initial);
      },
    },
    'next/navigation': {
      usePathname: () => '/collections',
      useRouter: () => ({ push: () => {}, replace: () => {} }),
    },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    './AppProvider': { useApp: () => ({ user, authReady: true }) },
    './ContributionProvider': {
      useContribution: () => ({ mockSignedIn, endMockSession: () => {} }),
    },
    './Qusasa': { Qusasa: () => null },
    './SocialIcon': { SocialIcon: () => null },
    './ui/Modal': {
      Modal: ({ open, title, children }) =>
        open ? React.createElement('div', { role: 'dialog', 'aria-label': title }, children) : null,
    },
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  const { Header } = load('src/components/Header.tsx', overrides);
  const { Footer } = load('src/components/Footer.tsx', overrides);
  return {
    header: renderToStaticMarkup(React.createElement(Header, { googleAuthOrigin })),
    footer: renderToStaticMarkup(React.createElement(Footer)),
  };
}
test('Account menu is available as a desktop popover and a mobile bottom sheet', () => {
  for (const mode of [{ popoverOpen: true }, { sheetOpen: true }]) {
    const { header } = navigation(null, mode);
    assert.match(header, /<button[^>]*class="account-avatar"[^>]*aria-haspopup="dialog"/);
    assert.match(header, /role="dialog" aria-label="(قائمة الحساب|الحساب)"/);
    assert.match(header, /أنت زائر/);
  }
});
test('Guest shows real Google entry, settings and help without a signed-in identity', () => {
  const { header, footer } = navigation(null, {
    popoverOpen: true,
    googleAuthOrigin: 'https://example.test',
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
test('Real member shows avatar, name, email, settings, help and logout only', () => {
  const user = { role: 'member', name: 'عضو تجريبي', email: 'member@example.test' };
  for (const mode of [{ popoverOpen: true }, { sheetOpen: true }]) {
    const { header, footer } = navigation(user, mode);
    for (const item of [user.name, user.email, 'الإعدادات', 'المساعدة', 'تسجيل الخروج'])
      assert.match(header, new RegExp(item));
    assert.match(header, /class="account-profile-avatar"/);
    assert.doesNotMatch(header + footer, /href="\/admin"|الاستوديو|>ADMIN<|الدخول بـ Google/);
  }
});
test('Only real admins see the Studio entry and ADMIN badge in their account menu', () => {
  const admin = { role: 'admin', name: 'مديرة المكتبة', email: 'admin@example.test' };
  const closed = navigation(admin);
  assert.doesNotMatch(closed.header, /href="\/admin"/);
  assert.match(closed.footer, /href="\/admin"/);
  for (const mode of [{ popoverOpen: true }, { sheetOpen: true }]) {
    const { header } = navigation(admin, mode);
    for (const item of [admin.name, admin.email, 'الإعدادات', 'المساعدة', 'تسجيل الخروج'])
      assert.match(header, new RegExp(item));
    assert.match(header, /class="account-role-badge">ADMIN<\/span>/);
    assert.match(header, /href="\/admin"[^>]*>.*الاستوديو/);
    assert.ok(header.indexOf('الاستوديو') < header.indexOf('الإعدادات'));
    assert.doesNotMatch(header, /الدخول بـ Google/);
  }
  const account = fs.readFileSync('src/features/Auth.tsx', 'utf8');
  assert.match(account, /app\.user\.role === 'admin' \? '\/admin' : '\/saved'/);
});
test('Mock contribution sign-in remains a guest, with its own session-end action', () => {
  const { header, footer } = navigation(null, { popoverOpen: true, mockSignedIn: true });
  assert.match(header, /أنت زائر/);
  assert.match(header, /إنهاء جلسة التجربة/);
  assert.match(header, /href="\/api\/auth\/oauth\/google"/);
  assert.doesNotMatch(header + footer, /href="\/admin"|الاستوديو|>ADMIN<|تسجيل الخروج/);
  assert.match(fs.readFileSync('src/components/Header.tsx', 'utf8'), /await app\.logout\(\)/);
});
