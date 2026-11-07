import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function load(file, overrides = {}) {
  const module = { exports: {} };
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(javascript, {
    module,
    exports: module.exports,
    URLSearchParams,
    require: (name) => (name in overrides ? overrides[name] : require(name)),
  });
  return module.exports;
}

const stateModule = load('src/components/ui/StatePanel.tsx', {
  '@/components/AppProvider': { useApp: () => ({ reduced: false }) },
});
const link = {
  __esModule: true,
  default: ({ children, ...props }) => React.createElement('a', props, children),
};
function page(file, props = {}) {
  const Page = load(file, { '@/components/ui/StatePanel': stateModule, 'next/link': link }).default;
  return renderToStaticMarkup(React.createElement(Page, props));
}

test('Error state offers the real reset callback without unverifiable data guarantees', () => {
  const html = page('src/app/error.tsx', { reset: () => {} });
  assert.match(html, /role="alert"/);
  assert.match(html, /تعذّر تحميل الصفحة/);
  assert.match(html, /<button[^>]*>إعادة المحاولة<\/button>/);
  assert.doesNotMatch(html, /لم تُحذف|تم الحفظ|نجاح/);
  assert.match(fs.readFileSync('src/app/error.tsx', 'utf8'), /onClick=\{reset\}/);
});

test('Missing page and offline are distinct and only offer an existing destination', () => {
  const missing = page('src/app/not-found.tsx');
  const offline = page('src/app/offline/page.tsx');
  assert.match(missing, /الصفحة غير موجودة/);
  assert.match(offline, /أنت دون اتصال/);
  assert.match(offline, /وليس كل المحتوى/);
  for (const html of [missing, offline]) {
    assert.match(html, /href="\/library"/);
    assert.doesNotMatch(html, /إعادة المحاولة|role="alert"/);
  }
});

test('Loading is busy, has twelve decorative skeletons and no fabricated progress or timers', () => {
  const html = page('src/app/library/loading.tsx');
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /جارٍ تحميل المكتبة/);
  assert.match(html, /class="state-loading-grid" aria-hidden="true"/);
  assert.equal((html.match(/<i>/g) || []).length, 12);
  assert.doesNotMatch(
    fs.readFileSync('src/app/library/loading.tsx', 'utf8'),
    /setTimeout|setInterval|%/,
  );
});

test('State library distinguishes permission from failure without changing authentication', () => {
  const html = renderToStaticMarkup(
    React.createElement(stateModule.StatePanel, {
      kind: 'permission',
      title: 'لا تملك صلاحية العرض',
      description: 'هذا المحتوى غير متاح لحسابك.',
    }),
  );
  assert.match(html, /state-panel--permission/);
  assert.doesNotMatch(html, /إعادة المحاولة|<button|<a /);
  const hidden = renderToStaticMarkup(
    React.createElement(stateModule.StatePanel, {
      kind: 'empty',
      title: 'لا نتائج',
      visible: false,
    }),
  );
  assert.equal(hidden, '');
});

test('Motion is local, exit-aware, and respects both reduction preferences', () => {
  const source = fs.readFileSync('src/components/ui/StatePanel.tsx', 'utf8');
  const css = fs.readFileSync('src/app/states.css', 'utf8');
  assert.match(source, /AnimatePresence/);
  assert.match(source, /exit=\{/);
  assert.match(source, /reduced \|\| systemReduced/);
  assert.match(source, /duration: quiet \? 0 : 0.16/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-motion='reduce'/);
  assert.match(css, /hover: hover/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /infinite|soft-pulse/);
});

test('Submission skeleton follows real readiness, not an artificial delay', () => {
  const source = fs.readFileSync('src/app/account/submissions/page.tsx', 'utf8');
  assert.match(source, /const loading = !contribution.ready \|\| !app.authReady/);
  assert.doesNotMatch(source, /setTimeout|setLoading/);
});
