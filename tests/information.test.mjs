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
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    { exports, require: (name) => (name in overrides ? overrides[name] : require(name)) },
  );
  return exports;
}
const { legacyInformationDestination } = load('src/lib/information.ts');
test('Legacy privacy fragments map only to a fixed internal destination', () => {
  for (const hash of ['#privacy', '#PRIVACY', '#%70rivacy'])
    assert.equal(legacyInformationDestination(hash), '/privacy');
  for (const hash of [
    '',
    '#faq',
    '#unknown',
    '#%zz',
    '#https://evil.invalid',
    '#//evil.invalid',
    '#javascript:alert(1)',
  ])
    assert.equal(legacyInformationDestination(hash), null);
});
test('Old about page permanently redirects to help, while sitemap lists the new pages only', async () => {
  const config = load('next.config.ts').default;
  assert.equal(
    JSON.stringify(await config.redirects()),
    JSON.stringify([{ source: '/about', destination: '/help', permanent: true }]),
  );
  const sitemap = fs.readFileSync('src/app/sitemap.ts', 'utf8');
  assert.doesNotMatch(sitemap, /\/about/);
  assert.match(sitemap, /\/help/);
  assert.match(sitemap, /\/privacy/);
  assert.equal(fs.existsSync('src/app/about/page.tsx'), false);
});
test('Navigation, homepage and sign-in contain no old story links', () => {
  for (const file of [
    'src/components/Header.tsx',
    'src/components/Footer.tsx',
    'src/features/Home.tsx',
    'src/features/Auth.tsx',
  ])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\/about|حكايتنا/);
  assert.doesNotMatch(fs.readFileSync('src/features/Home.tsx', 'utf8'), /story-section/);
  assert.match(fs.readFileSync('src/features/Auth.tsx', 'utf8'), /href="\/privacy"/);
});
const overrides = {
  'next/link': {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement('a', props, children),
  },
  '@/components/LegacyInformationLink': { LegacyInformationLink: () => null },
};
test('Help preserves user-critical guidance without a brand story', () => {
  const { default: Page, metadata } = load('src/app/help/page.tsx', overrides);
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.equal(metadata.alternates.canonical, '/help');
  for (const text of [
    'المساعدة',
    'id="faq"',
    'لا تُدمجان تلقائيًا',
    'وليس ملف الصورة أو الفيديو',
    'تسجيل الخروج',
    'بلا صوت',
    'دون إنترنت',
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /حكايتنا|البداية كانت موقف|المثل الشعبي الرقمي/);
});
test('Privacy covers identity, storage, usage events, content rights and account limitations', () => {
  const { default: Page, metadata } = load('src/app/privacy/page.tsx', overrides);
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.equal(metadata.alternates.canonical, '/privacy');
  for (const id of [
    'account-data',
    'browser-storage',
    'usage-data',
    'content-rights',
    'account-controls',
  ])
    assert.ok(html.includes('id="' + id + '"'));
  for (const text of [
    'لا نستقبل كلمة مرورك',
    'حذف الحساب ذاتيًا',
    'لا نربط هذه الأحداث بحساب المستخدم',
    'لا تعني أنه خالٍ من حقوق الآخرين',
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /النسخة المحلية|نسخة تجريبية •/);
});
test('Compact footer avoids self-links and provides a no-JavaScript privacy fallback on help', () => {
  for (const path of ['/', '/help', '/privacy']) {
    const { Footer } = load('src/components/Footer.tsx', {
      ...overrides,
      'next/navigation': { usePathname: () => path },
      './AppProvider': { useApp: () => ({ user: null }) },
    });
    const html = renderToStaticMarkup(React.createElement(Footer));
    assert.doesNotMatch(html, /footer-top|footer-note|حكايتنا|نسخة تجريبية|أسئلة تتكرر/);
    if (path === '/help') {
      assert.match(html, /id="privacy"/);
      assert.doesNotMatch(html, /href="\/help"/);
    }
    if (path === '/privacy') assert.doesNotMatch(html, /href="\/privacy"/);
  }
});
test('Service worker changes cache version and includes only the replacement public info routes', () => {
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /v4\.3-information/);
  assert.doesNotMatch(sw, /\/about/);
  assert.match(sw, /'\/help', '\/privacy'/);
});
