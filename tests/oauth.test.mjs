import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import * as jose from 'jose';
import Database from 'better-sqlite3';

function load(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {},
    URL,
    URLSearchParams,
    Response,
    Request,
    AbortSignal,
    process,
    ...globals,
    require: (name) => {
      if (name === 'server-only') return {};
      if (name in imports) return imports[name];
      throw Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}
const social = load('src/lib/social.ts');
const requestOrigin = load('src/lib/request-origin.ts');
const { oauthConfig } = load('src/server/oauth-config.ts', { '@/lib/social': social });
const { verifyIdentityToken } = load('src/server/oidc.ts', { jose });
const env = {
  NODE_ENV: 'production',
  OAUTH_SITE_URL: 'https://reactions.example',
  OAUTH_GOOGLE_CLIENT_ID: 'google-client',
  OAUTH_GOOGLE_CLIENT_SECRET: 'test-only',
  OAUTH_APPLE_CLIENT_ID: 'apple-client',
  OAUTH_APPLE_CLIENT_SECRET: 'test-only',
  OAUTH_MICROSOFT_CLIENT_ID: 'ms-client',
  OAUTH_MICROSOFT_CLIENT_SECRET: 'test-only',
};
const configs = Object.fromEntries(social.SOCIAL_PROVIDERS.map((p) => [p, oauthConfig(p, env)]));
const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
const jwk = await jose.exportJWK(publicKey);
jwk.kid = 'test-key';
const keys = jose.createLocalJWKSet({ keys: [jwk] });
const consumer = '9188040d-6c67-4c5b-b112-36a304b66dad';
async function token(config, overrides = {}) {
  return new jose.SignJWT({
    iss: Array.isArray(config.issuer) ? config.issuer[0] : config.issuer,
    aud: config.clientId,
    sub: 'provider-subject',
    nonce: 'nonce',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    email: 'member@example.com',
    email_verified: true,
    name: 'عضو',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(privateKey);
}
test('OAuth configuration fails closed without secrets or a safe public origin', () => {
  assert.equal(oauthConfig('google', {}), null);
  assert.equal(oauthConfig('google', { ...env, OAUTH_SITE_URL: 'http://public.example' }), null);
  assert.equal(
    oauthConfig('google', { ...env, OAUTH_SITE_URL: 'https://u:p@public.example' }),
    null,
  );
  assert.equal(
    oauthConfig('apple', {
      ...env,
      NODE_ENV: 'development',
      OAUTH_SITE_URL: 'http://localhost:3000',
    }),
    null,
  );
  assert.equal(
    oauthConfig('microsoft', { ...env, OAUTH_MICROSOFT_TENANT_ID: '../attacker' }),
    null,
  );
  assert.equal(
    configs.apple.redirectUri,
    'https://reactions.example/api/auth/oauth/apple/callback',
  );
});
test('OIDC accepts a valid signed identity; excludes unverified email', async () => {
  const identity = await verifyIdentityToken(
    await token(configs.google),
    configs.google,
    'nonce',
    keys,
  );
  assert.equal(identity.subject, 'provider-subject');
  assert.equal(identity.email, 'member@example.com');
  const unverified = await verifyIdentityToken(
    await token(configs.google, { email_verified: false }),
    configs.google,
    'nonce',
    keys,
  );
  assert.equal(unverified.email, null);
});
test('OIDC rejects wrong nonce, issuer, audience, authorized party, expiry and signature', async () => {
  for (const patch of [
    { nonce: 'wrong' },
    { iss: 'https://attacker.example' },
    { aud: 'another-client' },
    { azp: 'another-client' },
    { exp: 1 },
    { sub: '' },
  ]) {
    await assert.rejects(
      verifyIdentityToken(await token(configs.google, patch), configs.google, 'nonce', keys),
    );
  }
  const other = await jose.generateKeyPair('RS256');
  await assert.rejects(
    verifyIdentityToken(
      await token(configs.google),
      configs.google,
      'nonce',
      async () => other.publicKey,
    ),
  );
});
test('Microsoft tenant-specific issuer is checked, including tenant restrictions', async () => {
  const claims = { tid: consumer, iss: `https://login.microsoftonline.com/${consumer}/v2.0` };
  const signed = await token(configs.microsoft, claims);
  assert.equal(
    (await verifyIdentityToken(signed, configs.microsoft, 'nonce', keys)).subject,
    'provider-subject',
  );
  await assert.rejects(
    verifyIdentityToken(signed, { ...configs.microsoft, tenant: 'organizations' }, 'nonce', keys),
  );
  await assert.rejects(
    verifyIdentityToken(
      await token(configs.microsoft, { ...claims, tid: 'bad' }),
      configs.microsoft,
      'nonce',
      keys,
    ),
  );
});

function harness() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync('src/server/db.ts', 'utf8').match(/db.exec\(`([\s\S]*?)`\)/)[1]);
  const jar = new Map(),
    options = new Map(),
    sessions = [];
  const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
  class ApiError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  let patch = {},
    exchanges = 0;
  const api = load(
    'src/server/oauth.ts',
    {
      'node:crypto': crypto,
      '@/lib/social': social,
      '@/lib/request-origin': requestOrigin,
      'next/headers': {
        cookies: async () => ({
          get: (name) => (jar.has(name) ? { value: jar.get(name) } : undefined),
          set: (name, value, opts) => {
            options.set(name, opts);
            if (opts.maxAge === 0) jar.delete(name);
            else jar.set(name, value);
          },
        }),
      },
      './db': { db, audit: () => {} },
      './auth': {
        ApiError,
        digest,
        rateLimit: () => {},
        createSession: async (id) => sessions.push(id),
      },
      './oauth-config': { oauthConfig: (p) => configs[p] },
      './oidc': { verifyIdentityToken: (t, c, n) => verifyIdentityToken(t, c, n, keys) },
    },
    {
      fetch: async (url, options) => {
        exchanges++;
        const config = Object.values(configs).find((c) => c.tokenEndpoint === url);
        const flow = lastFlow;
        assert.equal(options.body.get('redirect_uri'), config.redirectUri);
        if (config.provider !== 'apple')
          assert.equal(options.body.get('code_verifier'), flow.verifier);
        return Response.json({ id_token: await token(config, { nonce: flow.nonce, ...patch }) });
      },
    },
  );
  let lastFlow;
  async function begin(provider = 'google') {
    const response = await api.beginOAuth(
      new Request(`https://reactions.example/api/auth/oauth/${provider}`, {
        headers: { host: 'reactions.example' },
      }),
      provider,
    );
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get('location'));
    lastFlow = db.prepare('SELECT * FROM oauth_flows ORDER BY rowid DESC LIMIT 1').get();
    return location;
  }
  const callback = (url, provider = 'google', extra = {}) => {
    const params = new URLSearchParams({
      state: url.searchParams.get('state'),
      code: 'test-code',
      ...extra,
    });
    return api.completeOAuth(
      new Request(
        `https://reactions.example/api/auth/oauth/${provider}/callback${provider === 'apple' ? '' : '?' + params}`,
        provider === 'apple' ? { method: 'POST', body: params } : {},
      ),
      provider,
    );
  };
  return {
    db,
    jar,
    options,
    sessions,
    api,
    begin,
    callback,
    setPatch: (p) => (patch = p),
    exchanges: () => exchanges,
  };
}
test('Google authorization has PKCE, state, nonce and creates one member/session; replay rejected', async () => {
  const h = harness();
  try {
    const url = await h.begin();
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal([...h.options.values()][0].httpOnly, true);
    assert.equal(
      (await h.callback(url)).headers.get('location'),
      'https://reactions.example/saved',
    );
    assert.equal(h.sessions.length, 1);
    assert.equal(h.db.prepare('SELECT role FROM users').get().role, 'member');
    assert.match((await h.callback(url)).headers.get('location'), /expired/);
    assert.equal(h.exchanges(), 1);
    const second = await h.begin();
    await h.callback(second);
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM users').get().n, 1);
  } finally {
    h.db.close();
  }
});
test('Missing browser binding and expired state fail before token exchange', async () => {
  const h = harness();
  try {
    const url = await h.begin();
    h.jar.clear();
    assert.match((await h.callback(url)).headers.get('location'), /expired/);
    const expired = await h.begin();
    h.db.prepare('UPDATE oauth_flows SET expires=1').run();
    assert.match((await h.callback(expired)).headers.get('location'), /expired/);
    assert.equal(h.exchanges(), 0);
    assert.equal(h.sessions.length, 0);
  } finally {
    h.db.close();
  }
});
test('Apple uses form_post and Secure SameSite=None transaction cookie, with validated callback', async () => {
  const h = harness();
  try {
    const url = await h.begin('apple');
    assert.equal(url.searchParams.get('response_mode'), 'form_post');
    assert.equal(url.searchParams.has('code_challenge'), false);
    assert.equal([...h.options.values()][0].sameSite, 'none');
    assert.equal([...h.options.values()][0].secure, true);
    assert.equal(
      (await h.callback(url, 'apple')).headers.get('location'),
      'https://reactions.example/saved',
    );
    assert.equal(h.sessions.length, 1);
  } finally {
    h.db.close();
  }
});
test('Cancellation is recoverable and creates no account', async () => {
  const h = harness();
  try {
    const url = await h.begin();
    assert.match(
      (await h.callback(url, 'google', { error: 'access_denied' })).headers.get('location'),
      /cancelled/,
    );
    assert.equal(h.exchanges(), 0);
    assert.equal(h.sessions.length, 0);
  } finally {
    h.db.close();
  }
});
test('Invalid identity token cannot create an account/session', async () => {
  const h = harness();
  try {
    const url = await h.begin();
    h.setPatch({ nonce: 'wrong' });
    assert.match((await h.callback(url)).headers.get('location'), /failed/);
    assert.equal(h.sessions.length, 0);
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM users').get().n, 0);
  } finally {
    h.db.close();
  }
});
test('An email collision never auto-links or takes over a legacy administrator', async () => {
  const h = harness();
  try {
    h.db
      .prepare('INSERT INTO users VALUES (?,?,?,?,?,?)')
      .run(
        'legacy-owner',
        'Owner',
        'member@example.com',
        'legacy-hash',
        'admin',
        new Date().toISOString(),
      );
    const url = await h.begin();
    assert.match((await h.callback(url)).headers.get('location'), /account_exists/);
    assert.equal(h.sessions.length, 0);
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM oauth_accounts').get().n, 0);
  } finally {
    h.db.close();
  }
});

test('Microsoft callback establishes a local member using the validated tenant identity', async () => {
  const h = harness();
  try {
    const url = await h.begin('microsoft');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    h.setPatch({
      tid: consumer,
      iss: `https://login.microsoftonline.com/${consumer}/v2.0`,
      email_verified: false,
    });
    assert.equal(
      (await h.callback(url, 'microsoft')).headers.get('location'),
      'https://reactions.example/saved',
    );
    assert.match(h.db.prepare('SELECT email FROM users').get().email, /@social\.invalid$/);
    assert.equal(h.sessions.length, 1);
  } finally {
    h.db.close();
  }
});
test('An already-linked owner keeps the same account, role and admin destination', async () => {
  const h = harness();
  try {
    h.db
      .prepare('INSERT INTO users VALUES (?,?,?,?,?,?)')
      .run('owner', 'Owner', 'member@example.com', 'legacy', 'admin', new Date().toISOString());
    h.db
      .prepare('INSERT INTO oauth_accounts VALUES (?,?,?,?,?)')
      .run(
        'google',
        'https://accounts.google.com',
        'provider-subject',
        'owner',
        new Date().toISOString(),
      );
    const url = await h.begin();
    assert.equal(
      (await h.callback(url)).headers.get('location'),
      'https://reactions.example/admin',
    );
    assert.equal(h.sessions[0], 'owner');
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM users').get().n, 1);
  } finally {
    h.db.close();
  }
});
test('Provider mismatch cannot consume a flow or create a session', async () => {
  const h = harness();
  try {
    const url = await h.begin('google');
    assert.match((await h.callback(url, 'microsoft')).headers.get('location'), /expired/);
    assert.equal(h.exchanges(), 0);
    assert.equal(h.sessions.length, 0);
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM oauth_flows').get().n, 1);
  } finally {
    h.db.close();
  }
});
