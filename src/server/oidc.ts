import 'server-only';
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { OAuthConfig } from './oauth-config';

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';
/** Email is profile data, never the identity key or an automatic account-linking credential. */
export async function verifyIdentityToken(
  token: string,
  config: OAuthConfig,
  nonce: string,
  keyResolver?: JWTVerifyGetKey,
) {
  let issuer = config.issuer;
  if (config.provider === 'microsoft') {
    // Unverified tid only selects the expected issuer; the signature and tid are verified below.
    const tid = decodeJwt(token).tid;
    if (
      typeof tid !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(tid)
    )
      throw Error('Invalid tenant');
    if (config.tenant === 'consumers' && tid !== CONSUMER_TENANT) throw Error('Wrong tenant');
    if (config.tenant === 'organizations' && tid === CONSUMER_TENANT) throw Error('Wrong tenant');
    if (
      !['common', 'consumers', 'organizations'].includes(config.tenant || '') &&
      tid !== config.tenant
    )
      throw Error('Wrong tenant');
    issuer = `https://login.microsoftonline.com/${tid}/v2.0`;
  }
  if (!keyResolver) {
    if (!keySets.has(config.jwksUri))
      keySets.set(
        config.jwksUri,
        createRemoteJWKSet(new URL(config.jwksUri), { timeoutDuration: 10000 }),
      );
    keyResolver = keySets.get(config.jwksUri)!;
  }
  const { payload } = await jwtVerify(token, keyResolver, {
    issuer,
    audience: config.clientId,
    algorithms: ['RS256'],
    requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp', 'nonce'],
    maxTokenAge: '10m',
    clockTolerance: 5,
  });
  if (
    payload.nonce !== nonce ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    payload.sub.length > 512
  )
    throw Error('Invalid identity');
  if (
    (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId) ||
    (payload.azp !== undefined && payload.azp !== config.clientId)
  )
    throw Error('Wrong authorized party');
  const verifiedEmail = payload.email_verified === true || payload.email_verified === 'true';
  const email =
    verifiedEmail &&
    typeof payload.email === 'string' &&
    payload.email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
      ? payload.email.toLowerCase()
      : null;
  return {
    subject: payload.sub,
    issuer: config.provider === 'google' ? 'https://accounts.google.com' : payload.iss!,
    email,
    name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 60) : '',
  };
}
