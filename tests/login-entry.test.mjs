import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);

function transpile(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports },
  );
  return exports;
}
function load(file, overrides) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => (name in overrides ? overrides[name] : require(name)),
    },
  );
  return module.exports;
}

const social = transpile('src/lib/social.ts');
const gate = transpile('src/lib/gate.ts');
const AuthStub = (props) => null;
const Auth = { __esModule: true, default: AuthStub };
const redirect = (to) => {
  throw Object.assign(new Error('redirect'), { to });
};
const redirects = { 'next/navigation': { redirect } };

function rootPage({ user = null, ready = { google: { origin: 'https://oauth.test' } } } = {}) {
  return load('src/app/page.tsx', {
    ...redirects,
    '@/features/Auth': Auth,
    '@/lib/social': social,
    '@/server/oauth-config': { oauthConfig: (provider) => ready[provider] || null },
    '@/server/auth': { currentUser: async () => user },
  });
}
function loginPage() {
  return load('src/app/login/page.tsx', {
    '@/features/Auth': Auth,
    '@/lib/social': social,
    '@/lib/gate': gate,
    '@/server/oauth-config': {
      oauthConfig: (provider) => (provider === 'google' ? { origin: 'https://oauth.test' } : null),
    },
  });
}

test('Root gateway page is dynamic, noindex, and canonical to itself', () => {
  const source = fs.readFileSync('src/app/page.tsx', 'utf8');
  assert.match(source, /export const dynamic = 'force-dynamic';/);
  assert.match(source, /robots: \{ index: false, follow: true \}/);
  assert.match(source, /alternates: \{ canonical: '\/' \}/);
  // ?q= يتقدّم فحص الجلسة — البحث سطح المكتبة حتى قبل الدخول
  assert.ok(source.indexOf('if (q)') < source.indexOf('currentUser()'));
});

test('Visitor at root with ?q= lands on the library search surface before any session check', async () => {
  const { default: Page } = rootPage({ user: { id: 'u1' } }); // حتى المسجَّل: q تتقدّم
  await assert.rejects(
    Page({ searchParams: Promise.resolve({ q: 'برامج' }) }),
    (error) => error.to === `/library?q=${encodeURIComponent('برامج')}`,
  );
});
test('Signed-in user at root goes straight to the library — never sees the gateway', async () => {
  const { default: Page } = rootPage({ user: { id: 'u1', role: 'member' } });
  await assert.rejects(Page({ searchParams: Promise.resolve({}) }), (e) => e.to === '/library');
  await assert.rejects(
    Page({ searchParams: Promise.resolve({ q: '' }) }),
    (e) => e.to === '/library',
  );
});
test('Visitor at root sees the gateway with server-decided readiness and a fixed next', async () => {
  const { default: Page } = rootPage({});
  const element = await Page({ searchParams: Promise.resolve({}) });
  assert.equal(element.type, AuthStub);
  assert.deepEqual([...element.props.readyProviders], ['google']);
  assert.equal(element.props.authOrigin, 'https://oauth.test');
  assert.equal(element.props.next, '/library');
  // بلا مفاتيح إطلاقًا: القائمة فارغة لا null
  const empty = await rootPage({ ready: {} }).default({
    searchParams: Promise.resolve({}),
  });
  assert.deepEqual([...empty.props.readyProviders], []);
  assert.equal(empty.props.authOrigin, '');
});
test('auth_error maps only known keys through SOCIAL_ERRORS; unknown keys are neutralized', async () => {
  const { default: Page } = rootPage({});
  const known = await Page({ searchParams: Promise.resolve({ auth_error: 'expired' }) });
  assert.equal(known.props.initialError, social.SOCIAL_ERRORS.expired);
  for (const bogus of ['__proto__', 'constructor', 'nope', '<script>']) {
    const element = await Page({ searchParams: Promise.resolve({ auth_error: bogus }) });
    assert.equal(element.props.initialError, '', bogus);
  }
});

test('/login keeps the same page, forwards a safe next, and never leaks a dead origin', async () => {
  const { default: Page, metadata } = loginPage();
  assert.match(metadata.title, /حسابك/);
  assert.equal(metadata.robots.index, false);
  const clean = await Page({ searchParams: Promise.resolve({ next: '/saved' }) });
  assert.equal(clean.props.next, '/saved');
  for (const hostile of ['//evil.test', 'https://evil.test', '/login', '/']) {
    const element = await Page({ searchParams: Promise.resolve({ next: hostile }) });
    assert.equal(element.props.next, '/library', hostile);
  }
  const empty = await Page({ searchParams: Promise.resolve({}) });
  assert.equal(empty.props.next, '/library');
});
