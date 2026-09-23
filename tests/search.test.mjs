import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync('src/lib/reactions.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const policyContext = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('scripts/video-policy.mjs', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
  policyContext,
);
const mediaContext = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/media.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  mediaContext,
);
const context = {
  exports: {},
  require: (name) => {
    if (name === './seed-media.json')
      return JSON.parse(fs.readFileSync('src/lib/seed-media.json', 'utf8'));
    if (name === './media') return mediaContext.exports;
    if (name === './video') return policyContext.exports;
    throw Error(name);
  },
};
vm.runInNewContext(code, context);
const { normalizeArabic, filterReactions, REACTIONS } = context.exports;
test('normalizes Arabic diacritics and hamza', () =>
  assert.equal(normalizeArabic('إِحْرَاج'), 'احراج'));
test('all nine categories have seed content', () =>
  assert.equal(new Set(REACTIONS.map((r) => r.category)).size, 9));
test('search uses all normalized query words', () =>
  assert.equal(filterReactions(REACTIONS, 'خبر صادم').length, 1));
test('category filtering is exact', () =>
  assert.equal(filterReactions(REACTIONS, '', 'reject').length, 2));
test('duration and sorting are composed', () => {
  const rows = filterReactions(REACTIONS, '', '', 'shortest', 3);
  assert.ok(rows.every((r) => r.duration <= 3));
  assert.equal(rows[0].duration, 2);
});
test('unique codes and honest demo flags', () => {
  assert.equal(new Set(REACTIONS.map((r) => r.code)).size, REACTIONS.length);
  assert.ok(REACTIONS.every((r) => r.isDemo && r.media.endsWith('.mp4')));
});
test('empty and unknown queries do not throw', () => {
  assert.equal(filterReactions(REACTIONS, '   ').length, 12);
  assert.equal(filterReactions(REACTIONS, 'nothing-matches').length, 0);
});

test('default discovery includes long videos through 60 seconds; short filters still apply', () => {
  const items = [2, 8, 9, 30, 59.999, 60, 60.001].map((duration, i) => ({
    ...REACTIONS[0],
    code: `TEST-${i}`,
    duration,
  }));
  assert.equal(filterReactions(items, '').length, 6);
  assert.equal(filterReactions(items, '', '', 'shortest', 3).length, 1);
});

test('Images stay discoverable regardless of null or stale duration values', () => {
  const images = [null, 999].map((duration, i) => ({
    ...REACTIONS[0],
    code: 'IMAGE-' + i,
    type: 'image',
    mimeType: 'image/png',
    duration,
  }));
  assert.equal(filterReactions(images, '', '', 'shortest', 1).length, 2);
});
