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

test('robots.txt is rendered per request so it uses the runtime origin', () => {
  // It is served from Railway, whose build stage has no service variables; a
  // static prerender would bake in the localhost fallback.
  const ctx = {
    exports: {},
    process: { env: { NEXT_PUBLIC_SITE_URL: 'https://yemreact.example/' } },
    require: (id) => {
      if (id !== '@/lib/site-url') throw new Error('unexpected import ' + id);
      const runtime = {
        exports: {},
        process: { env: { NEXT_PUBLIC_SITE_URL: 'https://yemreact.example/' } },
      };
      vm.runInNewContext(
        ts.transpileModule(fs.readFileSync('src/lib/site-url.ts', 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText,
        runtime,
      );
      return runtime.exports;
    },
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/app/robots.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    ctx,
  );
  const robots = ctx.exports;
  assert.equal(robots.dynamic, 'force-dynamic');
  const result = robots.default();
  assert.equal(result.sitemap, 'https://yemreact.example/sitemap.xml');
  assert.equal(result.rules.userAgent, '*');
  assert.ok(result.rules.disallow.includes('/admin'));
});
