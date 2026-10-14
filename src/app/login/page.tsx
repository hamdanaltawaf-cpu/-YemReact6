import Auth from '@/features/Auth';
import { SOCIAL_ERRORS, SOCIAL_PROVIDERS } from '@/lib/social';
import { safeNext } from '@/lib/gate';
import { oauthConfig } from '@/server/oauth-config';
export const metadata = { title: 'حسابك — حيّاك', robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; next?: string }>;
}) {
  const { auth_error, next } = await searchParams;
  const error =
    auth_error && Object.hasOwn(SOCIAL_ERRORS, auth_error) ? SOCIAL_ERRORS[auth_error] : '';
  const authOrigin =
    SOCIAL_PROVIDERS.map((provider) => oauthConfig(provider)?.origin).find(Boolean) || '';
  const readyProviders = SOCIAL_PROVIDERS.filter((p) => oauthConfig(p) !== null);
  // لا تُسرّب أي سرّية إلى المتصفح: الجاهزية أسماء فقط، والوجهة تُفلتر عبر safeNext داخليًا فقط.
  return (
    <Auth
      initialError={error || ''}
      authOrigin={authOrigin}
      readyProviders={[...readyProviders]}
      next={safeNext(next)}
    />
  );
}
