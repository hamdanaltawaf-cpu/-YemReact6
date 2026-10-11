import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function transpile(file) {
  const exports = {};
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(javascript, { exports, URL });
  return exports;
}

const {
  collectDeployChecks,
  deployLevel,
  siteUrlCheck,
  dataDirCheck,
  ffprobeCheck,
  socialAuthCheck,
  ownerCheck,
  storageCheck,
  contentCheck,
} = transpile('src/lib/deployment-health.ts');
const production = { nodeEnv: 'production' };
const levelOf = (check) => check.level;

test('Production without a public origin fails: metadata would still point at localhost', () => {
  for (const siteUrl of [undefined, '', 'not a url', 'http://localhost:3000'])
    assert.equal(levelOf(siteUrlCheck({ ...production, siteUrl })), 'fail');
  assert.equal(
    levelOf(siteUrlCheck({ ...production, siteUrl: 'http://yemreact.example' })),
    'fail',
  );
  assert.equal(
    levelOf(siteUrlCheck({ ...production, siteUrl: 'https://yemreact-production.up.railway.app' })),
    'ok',
  );
  // A path, query or credentials are not an origin; warn instead of silently accepting.
  assert.equal(
    levelOf(siteUrlCheck({ ...production, siteUrl: 'https://yemreact.example/library' })),
    'warn',
  );
  assert.equal(
    levelOf(siteUrlCheck({ ...production, siteUrl: 'https://user:pass@yemreact.example' })),
    'warn',
  );
});

test('Local development origin is reported as ok, never as a production failure', () => {
  assert.equal(
    levelOf(siteUrlCheck({ nodeEnv: 'development', siteUrl: 'http://localhost:3000' })),
    'ok',
  );
  assert.equal(levelOf(siteUrlCheck({ nodeEnv: 'development', siteUrl: undefined })), 'warn');
});

test('Relative or missing DATA_DIR warns; an absolute volume path passes', () => {
  assert.equal(levelOf(dataDirCheck({ dataDir: './data' })), 'warn');
  assert.equal(levelOf(dataDirCheck({ dataDir: undefined })), 'warn');
  assert.equal(levelOf(dataDirCheck({ dataDir: '/app/data' })), 'ok');
});

test('FFprobe is required for verification: a missing binary fails, unset only warns', () => {
  assert.equal(
    levelOf(ffprobeCheck({ ffprobePath: '/usr/bin/ffprobe', ffprobeAvailable: true })),
    'ok',
  );
  assert.equal(
    levelOf(ffprobeCheck({ ffprobePath: '/usr/bin/ffprobe', ffprobeAvailable: false })),
    'fail',
  );
  assert.equal(levelOf(ffprobeCheck({ ffprobePath: undefined })), 'warn');
});

test('Social auth reports configured providers and rejects a non-HTTPS origin', () => {
  assert.equal(levelOf(socialAuthCheck({ socialProviders: [] })), 'warn');
  assert.equal(levelOf(socialAuthCheck({ socialProviders: ['google'] })), 'ok');
  assert.equal(
    levelOf(
      socialAuthCheck({ oauthSiteUrl: 'http://yemreact.example', socialProviders: ['google'] }),
    ),
    'fail',
  );
  assert.equal(
    levelOf(
      socialAuthCheck({
        oauthSiteUrl: 'https://yemreact.example',
        socialProviders: ['google', 'apple'],
      }),
    ),
    'ok',
  );
});

test('Owner, storage and content checks separate warnings from hard failures', () => {
  assert.equal(levelOf(ownerCheck({ owners: 0 })), 'warn');
  assert.equal(levelOf(ownerCheck({ owners: 1 })), 'ok');
  assert.equal(levelOf(ownerCheck({ owners: undefined })), 'warn');
  assert.equal(levelOf(storageCheck({ uploadsWritable: false })), 'fail');
  assert.equal(levelOf(storageCheck({ uploadsWritable: true })), 'ok');
  assert.equal(levelOf(contentCheck({ reactions: 0 })), 'warn');
  assert.equal(levelOf(contentCheck({ reactions: 12 })), 'ok');
});

test('Overall level is fail only on a real failure, warn for unfinished setup', () => {
  assert.equal(deployLevel([{ id: 'a', level: 'ok' }]), 'ok');
  assert.equal(
    deployLevel([
      { id: 'a', level: 'ok' },
      { id: 'b', level: 'warn' },
    ]),
    'warn',
  );
  assert.equal(
    deployLevel([
      { id: 'a', level: 'warn' },
      { id: 'b', level: 'fail' },
    ]),
    'fail',
  );
});

test('Collected checks are stable, uniquely identified and ordered for the verifier', () => {
  const checks = collectDeployChecks({
    nodeEnv: 'production',
    siteUrl: 'https://yemreact-production.up.railway.app',
    dataDir: '/app/data',
    ffprobePath: '/usr/bin/ffprobe',
    ffprobeAvailable: true,
    oauthSiteUrl: 'https://yemreact-production.up.railway.app',
    socialProviders: ['google'],
    reactions: 12,
    owners: 1,
    uploadsWritable: true,
  });
  // The module is evaluated in a separate VM context, so compare plain data.
  assert.deepEqual(JSON.parse(JSON.stringify(checks.map((check) => check.id))), [
    'site-url',
    'data-dir',
    'ffprobe',
    'social-auth',
    'uploads',
    'owner',
    'content',
  ]);
  assert.equal(new Set(checks.map((check) => check.id)).size, checks.length);
  assert.equal(deployLevel(checks), 'ok');
  for (const check of checks) assert.ok(check.detail.length > 0);
});
