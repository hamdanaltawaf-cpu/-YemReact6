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
  { code: 'IMAGE', media: '/picture.png', duration: 0, publishedAt: '2026-09-19', caption: 'صورة' },
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
function renderSaved(authReady, savedIds) {
  const { default: Saved } = load('src/features/Saved.tsx', {
    '@/components/AppProvider': {
      useApp: () => ({ reactions: items, saved: savedIds, user: null, authReady }),
    },
    '@/lib/saved': saved,
    '@/components/ReactionMasonry': {
      ReactionMasonry: ({ items, savedView }) =>
        React.createElement(
          'div',
          { 'data-saved-view': savedView },
          items.map((r) => React.createElement('article', { key: r.code }, r.caption)),
        ),
    },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
  });
  return renderToStaticMarkup(React.createElement(Saved));
}
test('Saved page contains one name and no search, sorting, duration controls, counters or export toolbar', () => {
  const html = renderSaved(true, ['IMAGE', 'VIDEO']);
  assert.match(html, /<h1 id="saved-title">المحفوظات<\/h1>/);
  assert.match(html, /data-saved-view="true"/);
  assert.doesNotMatch(
    html,
    /<input|<select|<form|مجموعتك|تصدير|library-note|duration-filter|category-tabs/,
  );
});
test('Saved loading does not flash the empty state; an empty page offers library navigation', () => {
  const loading = renderSaved(false, []);
  assert.match(loading, /جارٍ تحميل المحفوظات/);
  assert.doesNotMatch(loading, /احتفظ بما يعجبك/);
  const empty = renderSaved(true, []);
  assert.match(empty, /احتفظ بما يعجبك/);
  assert.match(empty, /href="\/library"/);
});
test('Saved footer is absent, including the trailing-slash route; home footer is unchanged', () => {
  for (const pathname of ['/saved', '/saved/', '/']) {
    const { Footer } = load('src/components/Footer.tsx', {
      'next/navigation': { usePathname: () => pathname },
      './AppProvider': { useApp: () => ({ user: null }) },
      './Qusasa': { Qusasa: () => null },
      'next/link': {
        __esModule: true,
        default: ({ children, ...props }) => React.createElement('a', props, children),
      },
    });
    const html = renderToStaticMarkup(React.createElement(Footer));
    if (pathname === '/') assert.match(html, /<footer/);
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
