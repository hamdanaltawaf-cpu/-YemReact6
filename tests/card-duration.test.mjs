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
      return ({ children, href }) => React.createElement('a', { href }, children);
    if (name === 'lucide-react')
      return {
        Bookmark: () => null,
        Play: () => null,
        ArrowUpLeft: () => null,
        Expand: () => null,
      };
    if (name === './AppProvider')
      return { useApp: () => ({ saved: [], setPreview() {}, toggleSave() {} }) };
    throw Error(name);
  },
};
vm.runInNewContext(code, context);
const render = (media, duration = 3) =>
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
      },
    }),
  );
test('Video cards show the duration badge for supported video URLs only', () => {
  for (const media of [
    '/media/demo-1.mp4',
    '/api/media/upload.webm',
    '/VIDEO.MP4?token=x',
    '/clip.webm#t=1',
  ]) {
    const html = render(media);
    assert.match(html, /class="card-duration mono" dir="ltr">3s<\/span>/);
    assert.doesNotMatch(html, /card-code|card-tag|category-label/);
  }
});
test('Non-video cards never display a video duration, even if a duration exists in data', () => {
  for (const media of [
    '/image.jpg',
    '/image.webp',
    '/animation.gif',
    '/audio.mp3',
    '/not-mp4',
    '/image.jpg?file=video.mp4',
  ]) {
    // Query strings must not be interpreted as the media pathname.
    assert.doesNotMatch(render(media), /card-duration/);
  }
});
test('Invalid video durations are not rendered', () => {
  for (const duration of [0, -1, NaN, Infinity])
    assert.doesNotMatch(render('/clip.mp4', duration), /card-duration/);
});
