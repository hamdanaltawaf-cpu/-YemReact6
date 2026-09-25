import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
const mediaContext = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/media.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  mediaContext,
);
const media = mediaContext.exports;
const code = ts.transpileModule(fs.readFileSync('src/components/ReactionCard.tsx', 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;
const context = {
  exports: {},
  require: (name) => {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'react') return React;
    if (name === '@/lib/media') return media;
    if (name === 'next/image') return () => null;
    if (name === 'next/link')
      return ({ children, ...props }) => React.createElement('a', props, children);
    if (name === 'lucide-react')
      return {
        Bookmark: () => null,
        Play: () => null,
        ArrowUpLeft: () => null,
        Expand: () => null,
        FileQuestion: () => null,
      };
    if (name === './AppProvider') return { useApp: () => ({ saved: [], reduced: false }) };
    if (name === './ReactionMenu')
      return {
        ReactionMenu: () =>
          React.createElement(
            'button',
            { 'aria-label': 'خيارات لقطة', className: 'reaction-menu-trigger' },
            '…',
          ),
      };
    throw Error(name);
  },
};
vm.runInNewContext(code, context);
const render = (media, duration = 3, metadata = {}) =>
  renderToStaticMarkup(
    React.createElement(context.exports.ReactionCard, {
      reaction: {
        code: 'YR-0001',
        caption: 'لقطة',
        situation: 'موقف',
        media,
        poster: '/poster.webp',
        duration,
        category: 'laugh',
        isDemo: true,
        ...metadata,
      },
    }),
  );
const video = {
  type: 'video',
  mimeType: 'video/mp4',
  mediaVerified: true,
  mediaMetadataVersion: 1,
};
const image = { ...video, type: 'image', mimeType: 'image/png' };
test('Verified video cards restore the original seconds-only duration badge', () => {
  for (const url of ['/clip.mp4', '/clip.webm?x=.png', '/file', '/cover.jpg']) {
    const html = render(url, 3, video);
    assert.match(html, /class="card-duration mono" dir="ltr" aria-hidden="true">3s<\/span>/);
    assert.doesNotMatch(html, /media-kind-badge|<span>فيديو<\/span>/);

    assert.match(html, /عرض التفاصيل/);
    assert.match(html, /reaction-menu-trigger/);
    assert.doesNotMatch(html, /save-button|card-caption|card-play/);
    assert.doesNotMatch(html, /card-code|card-tag|category-label/);
  }
});
test('Images never inherit video duration or playback from names, posters or stale duration', () => {
  for (const url of ['/photo.jpg', '/photo.png?file=.mp4', '/file', '/clip.mp4']) {
    const html = render(url, 999, image);
    assert.doesNotMatch(html, /card-duration|999s|تشغيل الفيديو/);
    assert.match(html, /عرض التفاصيل/);
    assert.doesNotMatch(html, /<video|card-expand|save-button/);
  }
});
test('Missing or invalid video durations do not fabricate a badge or seconds', () => {
  for (const duration of [null, 0, -1, NaN, Infinity]) {
    const html = render('/clip.mp4', duration, video);
    assert.doesNotMatch(html, /card-duration|media-kind-badge/);
    assert.match(html, /data-media-type="video"/);
    assert.doesNotMatch(html, /dir="ltr"/);
  }
});
test('Unknown, mismatched and unverified metadata never imply video', () => {
  for (const metadata of [
    {},
    { ...video, mediaVerified: false },
    { ...video, mimeType: 'image/png' },
    { ...video, mediaMetadataVersion: 0 },
  ]) {
    const html = render('/clip.mp4', 3, metadata);
    assert.match(html, /data-media-type="unknown"/);
    assert.doesNotMatch(html, /card-duration|<video|card-expand/);
  }
});
