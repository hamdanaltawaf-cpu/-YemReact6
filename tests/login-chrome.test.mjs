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
      URL,
      process,
    },
  );
  return module.exports;
}
function transpile(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports },
  );
  return exports;
}
const chrome = transpile('src/lib/chrome.ts');
const { isGatewayPath } = chrome;

test('Shared chrome logic: exactly two gateway paths, no partial exceptions', () => {
  assert.equal(isGatewayPath('/'), true);
  assert.equal(isGatewayPath('/login'), true);
  for (const notGateway of [
    '/library',
    '/help',
    '/privacy',
    '/offline',
    '/saved',
    '/collections',
    '/r/xyz',
    '/login/',
    '/logins',
    '/LogIn',
    '/LOGIN',
    '/?q=1', // استعلام ليس مسارًا — المسار نفسه هو ما يُقارَن
    '',
    null,
    undefined,
  ])
    assert.equal(isGatewayPath(notGateway), false, String(notGateway));
});

function headerHtml(pathname) {
  const { Header } = load('src/components/Header.tsx', {
    react: {
      ...React,
      useState: (initial) => React.useState(typeof initial === 'function' ? initial() : initial),
    },
    'next/navigation': {
      usePathname: () => pathname,
      useRouter: () => ({ push: () => {}, replace: () => {} }),
    },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    './AppProvider': { useApp: () => ({ user: null, authReady: true }) },
    './ContributionProvider': {
      useContribution: () => ({ mockSignedIn: false, endMockSession: () => {} }),
    },
    './glass-nav/GlassNav': {
      GlassNav: () => React.createElement('nav', { className: 'glass-nav' }, null),
    },
    './Qusasa': { Qusasa: () => null },
    './SocialIcon': { SocialIcon: () => null },
    '@/lib/chrome': chrome,
    'lucide-react': new Proxy({}, { get: () => () => null }),
  });
  return renderToStaticMarkup(React.createElement(Header, {}));
}
function footerHtml(pathname) {
  const { Footer } = load('src/components/Footer.tsx', {
    'next/navigation': { usePathname: () => pathname },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    './AppProvider': { useApp: () => ({ user: null }) },
    '@/lib/chrome': chrome,
  });
  return renderToStaticMarkup(React.createElement(Footer));
}
function glassNavHtml(pathname) {
  const { GlassNav } = load('src/components/glass-nav/GlassNav.tsx', {
    'next/navigation': { usePathname: () => pathname },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    './glass-nav.css': {},
    '@/lib/chrome': chrome,
  });
  return renderToStaticMarkup(React.createElement(GlassNav, {}));
}

test('SSR: gateway paths hide header, footer and glass-nav from the first byte — no flash', () => {
  assert.equal(headerHtml('/'), '');
  assert.equal(headerHtml('/login'), '');
  assert.equal(footerHtml('/'), '');
  assert.equal(footerHtml('/login'), '');
  assert.equal(glassNavHtml('/'), '');
  assert.equal(glassNavHtml('/login'), '');
});
test('SSR: every other surface keeps its chrome (header, and glass-nav, and footer rules as before)', () => {
  for (const pathname of ['/library', '/help', '/privacy', '/r/xyz', '/collections']) {
    assert.match(headerHtml(pathname), /class="site-header"/, `header on ${pathname}`);
    assert.match(glassNavHtml(pathname), /class="glass-nav/, `glass-nav on ${pathname}`);
  }
  // الفوتر: لم يتغيّر سلوكه خارج مساري البوّابة (يُخفى في /library و/saved كما كان)
  assert.match(footerHtml('/help'), /class="site-footer"/);
  assert.match(footerHtml('/privacy'), /class="site-footer"/);
  assert.equal(footerHtml('/library'), '');
  assert.equal(footerHtml('/saved'), '');
});

test('The "/" search shortcut targets the existing search field only — never swallows the key', () => {
  const source = fs.readFileSync('src/components/Header.tsx', 'utf8');
  const start = source.indexOf('const shortcut = (event: KeyboardEvent) => {');
  assert.ok(start > -1, 'shortcut handler found');
  const end = source.indexOf('window.addEventListener', start);
  const shortcut = source.slice(start, end);
  // الحارس قبل preventDefault: بلا حقل بحث (بوّابة الدخول) يخرج دون ابتلاع المفتاح
  const guardAt = shortcut.indexOf('if (!field) return;');
  const preventAt = shortcut.indexOf('event.preventDefault();');
  assert.ok(guardAt > -1 && preventAt > guardAt, 'field guard must precede preventDefault');
  assert.match(shortcut, /#library-search/);
});
