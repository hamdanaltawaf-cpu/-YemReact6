import 'server-only';
import type { SocialProvider } from '@/lib/social';

export type OAuthConfig = {
  provider: SocialProvider;
  origin: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  issuer: string | string[];
  tenant?: string;
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function oauthConfig(
  provider: SocialProvider,
  env: NodeJS.ProcessEnv = process.env,
): OAuthConfig | null {
  const clientId = env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID`]?.trim();
  const clientSecret = env[`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET`]?.trim();
  if (!clientId || !clientSecret || !env.OAUTH_SITE_URL) return null;
  let site: URL;
  try {
    site = new URL(env.OAUTH_SITE_URL);
  } catch {
    return null;
  }
  const localDev =
    env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(site.hostname);
  if (site.username || site.password || site.search || site.hash || site.pathname !== '/')
    return null;
  if (
    site.protocol !== 'https:' &&
    !(localDev && site.protocol === 'http:' && provider !== 'apple')
  )
    return null;
  if (provider === 'apple' && ['localhost', '127.0.0.1'].includes(site.hostname)) return null;
  const common = {
    provider,
    origin: site.origin,
    clientId,
    clientSecret,
    redirectUri: `${site.origin}/api/auth/oauth/${provider}/callback`,
  };
  if (provider === 'google')
    return {
      ...common,
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    };
  if (provider === 'apple')
    return {
      ...common,
      authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
      tokenEndpoint: 'https://appleid.apple.com/auth/token',
      jwksUri: 'https://appleid.apple.com/auth/keys',
      issuer: 'https://appleid.apple.com',
    };
  const tenant = (env.OAUTH_MICROSOFT_TENANT_ID || 'common').toLowerCase();
  if (!['common', 'organizations', 'consumers'].includes(tenant) && !UUID.test(tenant)) return null;
  const base = `https://login.microsoftonline.com/${tenant}`;
  return {
    ...common,
    tenant,
    authorizationEndpoint: `${base}/oauth2/v2.0/authorize`,
    tokenEndpoint: `${base}/oauth2/v2.0/token`,
    jwksUri: `${base}/discovery/v2.0/keys`,
    issuer: `${base}/v2.0`,
  };
}
