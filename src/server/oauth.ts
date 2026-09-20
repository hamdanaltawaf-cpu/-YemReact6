import 'server-only';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { db, audit } from './db';
import { ApiError, createSession, digest, rateLimit } from './auth';
import { oauthConfig, type OAuthConfig } from './oauth-config';
import { verifyIdentityToken } from './oidc';
import { isSocialProvider, type SocialProvider } from '@/lib/social';
import { matchesPublicHost } from '@/lib/request-origin';

const TTL = 600;
const random = () => randomBytes(32).toString('hex');
const cookieName = (state: string) => `yr_oauth_${digest(state).slice(0, 16)}`;
export function authRedirect(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
const failure = (code: string) => authRedirect(`/login?auth_error=${code}`);
function transactionCookie(config: OAuthConfig) {
  return {
    httpOnly: true,
    secure: config.origin.startsWith('https:'),
    sameSite: config.provider === 'apple' ? ('none' as const) : ('lax' as const),
    path: '/api/auth/oauth',
    maxAge: TTL,
  };
}
export async function beginOAuth(req: Request, provider: string) {
  if (!isSocialProvider(provider)) return failure('unavailable');
  const config = oauthConfig(provider);
  if (!config) return failure('unavailable');
  // A callback must return to the same public host that set the browser-binding cookie.
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!matchesPublicHost(host, config.origin, process.env.OAUTH_PROXY_HOST))
    return failure('unavailable');
  try {
    rateLimit(req, 'oauth-start', 20);
    db.prepare('DELETE FROM oauth_flows WHERE expires<?').run(Date.now());
    const state = random(),
      browser = random(),
      nonce = random(),
      verifier = random();
    db.prepare('INSERT INTO oauth_flows VALUES (?,?,?,?,?,?)').run(
      digest(state),
      provider,
      digest(browser),
      nonce,
      verifier,
      Date.now() + TTL * 1000,
    );
    (await cookies()).set(cookieName(state), browser, transactionCookie(config));
    const url = new URL(config.authorizationEndpoint);
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: provider === 'apple' ? 'name email' : 'openid profile email',
      state,
      nonce,
      ...(provider === 'apple'
        ? { response_mode: 'form_post' }
        : {
            code_challenge: createHash('sha256').update(verifier).digest('base64url'),
            code_challenge_method: 'S256',
            prompt: 'select_account',
          }),
    }).toString();
    return authRedirect(url.toString());
  } catch (e) {
    return failure(e instanceof ApiError && e.status === 429 ? 'rate_limited' : 'failed');
  }
}
type Flow = {
  provider: SocialProvider;
  browser_hash: string;
  nonce: string;
  verifier: string;
  expires: number;
};

/** Never merge accounts or promote roles based solely on an email returned by an IdP. */
function resolveAccount(
  provider: SocialProvider,
  identity: Awaited<ReturnType<typeof verifyIdentityToken>>,
) {
  return db.transaction(() => {
    const existing = db
      .prepare('SELECT user_id FROM oauth_accounts WHERE provider=? AND issuer=? AND subject=?')
      .get(provider, identity.issuer, identity.subject) as { user_id: string } | undefined;
    if (existing) return existing.user_id;
    if (identity.email && db.prepare('SELECT id FROM users WHERE email=?').get(identity.email))
      throw new ApiError(409, 'account_exists');
    const id = randomUUID();
    // Preserve the legacy NOT NULL schema; this sentinel cannot be used as a credential.
    const email = identity.email || `${id}@social.invalid`;
    db.prepare(
      'INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',
    ).run(
      id,
      identity.name || 'صاحب الرد',
      email,
      'social-only',
      'member',
      new Date().toISOString(),
    );
    db.prepare('INSERT INTO oauth_accounts VALUES (?,?,?,?,?)').run(
      provider,
      identity.issuer,
      identity.subject,
      id,
      new Date().toISOString(),
    );
    audit(id, 'social-register', provider);
    return id;
  })();
}
export async function completeOAuth(req: Request, provider: string) {
  if (!isSocialProvider(provider)) return failure('unavailable');
  const config = oauthConfig(provider);
  if (!config) return failure('unavailable');
  try {
    // Apple posts back cross-site. State + the HttpOnly browser-binding cookie replace sameOrigin here.
    if (
      (provider === 'apple' && req.method !== 'POST') ||
      (provider !== 'apple' && req.method !== 'GET')
    )
      return failure('expired');
    let params: URLSearchParams;
    if (req.method === 'POST') {
      if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
        return failure('failed');
      const body = await req.text();
      if (body.length > 32768) return failure('failed');
      params = new URLSearchParams(body);
    } else params = new URL(req.url).searchParams;
    const state = params.get('state') || '';
    if (!/^[a-f0-9]{64}$/.test(state)) return failure('expired');
    const jar = await cookies(),
      browser = jar.get(cookieName(state))?.value;
    jar.set(cookieName(state), '', { ...transactionCookie(config), maxAge: 0 });
    if (!browser) return failure('expired');
    // Atomic consumption prevents replay and keeps a request from another browser from consuming the flow.
    const flow = db
      .prepare(
        'DELETE FROM oauth_flows WHERE state_hash=? AND provider=? AND browser_hash=? RETURNING *',
      )
      .get(digest(state), provider, digest(browser)) as Flow | undefined;
    if (!flow || flow.expires < Date.now()) return failure('expired');
    if (params.get('error'))
      return failure(params.get('error') === 'access_denied' ? 'cancelled' : 'failed');
    const code = params.get('code');
    if (!code || code.length > 8192) return failure('failed');
    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        ...(provider === 'apple' ? {} : { code_verifier: flow.verifier }),
      }),
    });
    if (!response.ok) return failure('failed');
    const tokens = await response.json();
    if (typeof tokens.id_token !== 'string') return failure('failed');
    const identity = await verifyIdentityToken(tokens.id_token, config, flow.nonce);
    const userId = resolveAccount(provider, identity);
    // Rotate this browser's previous session; provider access/refresh tokens are not retained.
    const previous = jar.get('yr_session')?.value;
    if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(previous));
    await createSession(userId);
    audit(userId, 'social-login', provider);
    const user = db.prepare('SELECT role FROM users WHERE id=?').get(userId) as { role: string };
    return authRedirect(`${config.origin}${user.role === 'admin' ? '/admin' : '/saved'}`);
  } catch (e) {
    // Never reflect provider error descriptions, credentials, codes or tokens into the UI or logs.
    return failure(e instanceof ApiError && e.status === 409 ? 'account_exists' : 'failed');
  }
}
