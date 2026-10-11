import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// The module reads process.env by default; an empty env keeps the fallback deterministic.
const context = { exports: {}, process: { env: {} } };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/site-url.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  context,
);
const { publicOrigin } = context.exports;

test('A trailing slash never leaks into published URLs', () => {
  assert.equal(publicOrigin('https://yemreact.example/'), 'https://yemreact.example');
  assert.equal(publicOrigin('https://yemreact.example///'), 'https://yemreact.example');
  assert.equal(publicOrigin('  https://yemreact.example  '), 'https://yemreact.example');
});

test('A missing or empty origin falls back to the local placeholder', () => {
  assert.equal(publicOrigin(undefined), 'http://localhost:3000');
  assert.equal(publicOrigin(''), 'http://localhost:3000');
  assert.equal(publicOrigin('   '), 'http://localhost:3000');
});

test('Paths and ports are preserved, and the published sitemap URL stays valid', () => {
  assert.equal(publicOrigin('http://localhost:3100'), 'http://localhost:3100');
  const declared = `${publicOrigin('https://yemreact.example/')}/sitemap.xml`;
  assert.equal(declared, 'https://yemreact.example/sitemap.xml');
  assert.equal(new URL(declared).pathname, '/sitemap.xml');
});
