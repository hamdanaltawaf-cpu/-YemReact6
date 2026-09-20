import Auth from '@/features/Auth';
import { SOCIAL_ERRORS, SOCIAL_PROVIDERS } from '@/lib/social';
import { oauthConfig } from '@/server/oauth-config';
export const metadata = { title: 'حسابك — حيّاك', robots: { index: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const { auth_error } = await searchParams;
  const error =
    auth_error && Object.hasOwn(SOCIAL_ERRORS, auth_error) ? SOCIAL_ERRORS[auth_error] : '';
  const authOrigin =
    SOCIAL_PROVIDERS.map((provider) => oauthConfig(provider)?.origin).find(Boolean) || '';
  return <Auth initialError={error || ''} authOrigin={authOrigin} />;
}
