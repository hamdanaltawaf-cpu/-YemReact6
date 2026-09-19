import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync('src/lib/reactions.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
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
