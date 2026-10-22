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
const media = load('src/lib/media.ts');
const saved = load('src/lib/saved.ts');
const items = [
  {
    type: 'image',
    mimeType: 'image/png',
    mediaVerified: true,
    mediaMetadataVersion: 1,
    code: 'IMAGE',
    media: '/picture.png',
    duration: 0,
    publishedAt: '2026-09-19',
    caption: 'صورة',
  },
  { code: 'VIDEO', media: '/clip.mp4', duration: 60, publishedAt: '2026-09-20', caption: 'فيديو' },
  {
    code: 'PHOTO',
    media: '/picture.webp',
    duration: 999,
    publishedAt: '2026-09-21',
    caption: 'صورة أخرى',
  },
];
test('Saved selection preserves mixed media without duration gates and ignores missing/duplicate saved IDs', () => {
  const result = saved.savedReactions(items, ['IMAGE', 'VIDEO', 'PHOTO', 'IMAGE', 'missing']);
  assert.deepEqual(
    Array.from(result, (r) => r.code),
    ['PHOTO', 'VIDEO', 'IMAGE'],
  );
  assert.equal(items[0].code, 'IMAGE');
  assert.equal(saved.savedReactions(items, []).length, 0);
});
test('Media kinds use the pathname, not query text', () => {
  assert.equal(media.isVideoMedia('/clip.WEBM?x=1'), true);
  assert.equal(media.isImageMedia('/photo.JPEG#x'), true);
  assert.equal(media.isVideoMedia('/photo.png?clip=.mp4'), false);
  assert.equal(media.isImageMedia('/clip.mp4?poster=.png'), false);
});
test('Downloads keep the actual image/video file extension', () => {
  for (const [src, mime, extension] of [
    ['/photo.PNG?x=1', '', '.png'],
    ['/photo.webp', 'image/webp', '.webp'],
    ['/photo.jpeg', 'image/jpeg', '.jpg'],
    ['/clip.mp4', 'video/mp4', '.mp4'],
    ['/clip.WEBM#x', '', '.webm'],
    ['/file', 'image/png; charset=binary', '.png'],
    ['/unknown', '', '.bin'],
  ])
    assert.equal(media.mediaFileExtension(src, mime), extension);
});
test('Batch 3: /saved redirects to /account where the saved section lives; guest saves stay strictly local — never merged, never sent', () => {
  const page = fs.readFileSync('src/app/saved/page.tsx', 'utf8');
  assert.match(page, /redirect\('\/account'\)/);
  assert.doesNotMatch(page, /features\/Saved/);
  assert.ok(!fs.existsSync('src/features/Saved.tsx'), 'مكوّن المحفوظات المستقل ما زال موجودًا');
  // القسم قائم في صفحة الحساب فعلًا: مبدّل بلسانَي المحفوظات/مساهماتي يبدأ بالمحفوظات
  const surface = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  assert.match(surface, /id="account-tab-saved"/);
  assert.match(surface, /useState<'saved' \| 'contributions'>\('saved'\)/);
  // الفضاءان منفصلان كما كان — ولا شيء في هذه الدفعة يغيّره: فضاء الحساب
  // (/api/saved) حصري لجلسة حقيقية (requireUser على القراءة والكتابة)،
  // والزائر على مخزنه المحلي يظهر له وحده ضمن الصفحة نفسها دون دمج أو رفع.
  const api = fs.readFileSync('src/app/api/saved/route.ts', 'utf8');
  assert.match(api, /requireUser\(\)/);
  const provider = fs.readFileSync('src/components/AppProvider.tsx', 'utf8');
  assert.match(provider, /else setSaved\(read\('yr:guest-saved', \[\]\)\)/);
  const toggleBlock = provider.slice(
    provider.indexOf('async function toggleSave'),
    provider.indexOf('async function refresh'),
  );
  const putAt = toggleBlock.indexOf("fetch('/api/saved'");
  assert.ok(
    putAt > toggleBlock.indexOf('if (user) {') && putAt < toggleBlock.indexOf('} else '),
    'كتابة /api/saved خرجت عن ذراع المستخدم المسجل — ذريعة دمج محتملة!',
  );
});
test('Library and saved hide the footer, while the collections footer remains', () => {
  for (const pathname of ['/saved', '/saved/', '/library', '/collections']) {
    const { Footer } = load('src/components/Footer.tsx', {
      'next/navigation': { usePathname: () => pathname },
      './AppProvider': { useApp: () => ({ user: null }) },
      './Qusasa': { Qusasa: () => null },
      // بديل مطابق لعقد src/lib/chrome.ts (مسارا البوّابة فقط)
      '@/lib/chrome': { isGatewayPath: (p) => p === '/' || p === '/login' },
      'next/link': {
        __esModule: true,
        default: ({ children, ...props }) => React.createElement('a', props, children),
      },
    });
    const html = renderToStaticMarkup(React.createElement(Footer));
    if (pathname === '/collections') assert.match(html, /<footer/);
    else assert.equal(html, '');
  }
});
test('Image preview uses an image, not a video element', () => {
  const { ClipPlayer } = load('src/components/Clip.tsx', {
    '@/lib/media': media,
    './AppProvider': { useApp: () => ({ saved: [] }), track: () => {} },
    'next/image': {
      __esModule: true,
      default: ({ src, alt }) => React.createElement('img', { src, alt }),
    },
  });
  const html = renderToStaticMarkup(React.createElement(ClipPlayer, { reaction: items[0] }));
  assert.match(html, /<img/);
  assert.doesNotMatch(html, /<video|<source/);
});
