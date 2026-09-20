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
function navigation(user, mobile = false) {
  let states = 0;
  const overrides = {
    react: {
      ...React,
      useState: (initial) => React.useState(states++ === 0 && mobile ? true : initial),
    },
    'next/navigation': { usePathname: () => '/' },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    './AppProvider': { useApp: () => ({ user, notices: [] }) },
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
test('Guest and member navigation omit every studio link, including mobile and footer', () => {
  for (const user of [null, { role: 'member', name: 'Member' }]) {
    for (const mobile of [false, true]) {
      const { header, footer } = navigation(user, mobile);
      assert.doesNotMatch(header + footer, /href="\/admin"|الاستوديو/);
    }
  }
});
test('Admin navigation retains studio links on desktop, mobile and footer', () => {
  for (const mobile of [false, true]) {
    const { header, footer } = navigation({ role: 'admin', name: 'Admin' }, mobile);
    assert.equal((header.match(/href="\/admin"/g) || []).length, mobile ? 2 : 1);
    assert.match(footer, /href="\/admin"/);
  }
});

test('Header avatar opens the account page without a logout action', () => {
  for (const role of ['member', 'admin']) {
    for (const mobile of [false, true]) {
      const { header } = navigation({ role, name: 'Account' }, mobile);
      assert.match(
        header,
        /<a(?=[^>]*class="account-chip")(?=[^>]*href="\/login")(?=[^>]*aria-label="الحساب")/,
      );
      assert.doesNotMatch(header, /تسجيل الخروج/);
    }
  }
  assert.doesNotMatch(fs.readFileSync('src/components/Header.tsx', 'utf8'), /app\.logout|LogOut/);
});
