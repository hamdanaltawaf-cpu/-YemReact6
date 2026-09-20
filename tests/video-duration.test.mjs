import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/video.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  context,
);
const { MIN_VIDEO_DURATION, MAX_VIDEO_DURATION, isValidVideoDuration } = context.exports;
test('video duration boundaries are inclusive: 2 and 60 seconds', () => {
  assert.equal(MIN_VIDEO_DURATION, 2);
  assert.equal(MAX_VIDEO_DURATION, 60);
  for (const duration of [2, 2.001, 8, 30, 59.999, 60])
    assert.equal(isValidVideoDuration(duration), true);
});
test('video duration rejects values outside bounds without rounding or tolerance', () => {
  for (const duration of [
    1.999999,
    0,
    -2,
    60.000001,
    60.01,
    61,
    NaN,
    Infinity,
    -Infinity,
    '60',
    null,
    undefined,
  ]) {
    assert.equal(isValidVideoDuration(duration), false);
  }
});
