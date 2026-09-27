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
function navigation(user, popoverOpen = false) {
  let states = 0;
  const overrides = {
    react: {
      ...React,
      useState: (initial) => React.useState(states++ === 0 && popoverOpen ? true : initial),
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
      useContribution: () => ({ mockSignedIn: false, endMockSession: () => {} }),
    },
    './Qusasa': { Qusasa: () => null },
    './ui/Modal': { Modal: () => null },
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  const { Header } = load('src/components/Header.tsx', overrides);
  const { Footer } = load('src/components/Footer.tsx', overrides);
  return {
    header: renderToStaticMarkup(React.createElement(Header)),
    footer: renderToStaticMarkup(React.createElement(Footer)),
  };
}
test('Guest and member navigation omit every studio link', () => {
  for (const user of [null, { role: 'member', name: 'Member' }]) {
    for (const open of [false, true]) {
      const { header, footer } = navigation(user, open);
      assert.doesNotMatch(header + footer, /href="\/admin"|الاستوديو/);
    }
  }
});
test('Only owners reach the studio through their account page or footer', () => {
  for (const open of [false, true]) {
    const { header, footer } = navigation({ role: 'admin', name: 'Admin' }, open);
    assert.doesNotMatch(header, /href="\/admin"/);
    assert.match(footer, /href="\/admin"/);
  }
  const account = fs.readFileSync('src/features/Auth.tsx', 'utf8');
  assert.match(account, /app\.user\.role === 'admin' \? '\/admin' : '\/saved'/);
});

test('Avatar opens an account popover with settings, account, help and signed-in logout', () => {
  for (const role of ['member', 'admin']) {
    const { header } = navigation({ role, name: 'Account' }, true);
    assert.match(header, /<button[^>]*class="account-avatar"[^>]*aria-haspopup="dialog"/);
    assert.match(header, /role="dialog" aria-label="قائمة الحساب"/);
    for (const item of ['الإعدادات', 'الحساب', 'المساعدة', 'تسجيل الخروج'])
      assert.match(header, new RegExp(item));
    assert.match(header, /href="\/login"/);
  }
  assert.doesNotMatch(navigation(null, true).header, /تسجيل الخروج/);
  assert.match(fs.readFileSync('src/components/Header.tsx', 'utf8'), /await app\.logout\(\)/);
});
