import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context = { exports: {}, URL };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/request-origin.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  context,
);
const { matchesPublicHost, isSameOriginRequest } = context.exports;
const origin = 'https://app.example',
  proxy = 'trusted-proxy.example';
test('OAuth host accepts only the public host or exact configured proxy', () => {
  assert.equal(matchesPublicHost('app.example', origin), true);
  assert.equal(matchesPublicHost(proxy, origin, proxy), true);
  for (const host of ['evil.example', 'trusted-proxy.example.evil.test', proxy + ':99', null])
    assert.equal(matchesPublicHost(host, origin, proxy), false);
  assert.equal(matchesPublicHost(proxy, origin), false);
});
test('Same-origin mutations work on direct or explicitly mapped public origins', () => {
  assert.equal(isSameOriginRequest(origin, 'app.example'), true);
  assert.equal(isSameOriginRequest(origin, proxy, origin, proxy), true);
  assert.equal(isSameOriginRequest(origin, proxy), false);
});
test('Proxy mapping never authorizes unrelated, missing or malformed origins', () => {
  for (const bad of [
    null,
    'null',
    'https://evil.example',
    'http://app.example',
    'https://app.example:999',
    'https://app.example/path',
    'not-a-url',
  ]) {
    assert.equal(isSameOriginRequest(bad, proxy, origin, proxy), false);
  }
  assert.equal(isSameOriginRequest(origin, 'different-proxy.example', origin, proxy), false);
});

test('Cross-site browser mutations are rejected even when a proxy rewrites Origin', () => {
  assert.equal(isSameOriginRequest(origin, 'app.example', origin, proxy, 'cross-site'), false);
  assert.equal(isSameOriginRequest('https://' + proxy, proxy, origin, proxy, 'cross-site'), false);
  assert.equal(isSameOriginRequest(origin, proxy, origin, proxy, 'same-origin'), true);
});
