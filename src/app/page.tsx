import { redirect } from 'next/navigation';
import Auth from '@/features/Auth';
import { SOCIAL_ERRORS, SOCIAL_PROVIDERS } from '@/lib/social';
import { oauthConfig } from '@/server/oauth-config';
import { currentUser } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'حسابك — حيّاك',
  robots: { index: false, follow: true },
  alternates: { canonical: '/' },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; auth_error?: string }>;
}) {
  const { q, auth_error } = await searchParams;
  // البحث حالة من المكتبة دائمًا (DECISION-51 محفوظ): ?q= يتقدّم حتى قبل فحص الجلسة
  if (q) redirect(`/library?q=${encodeURIComponent(q)}`);
  if (await currentUser()) redirect('/library');
  const error =
    auth_error && Object.hasOwn(SOCIAL_ERRORS, auth_error) ? SOCIAL_ERRORS[auth_error] : '';
  const authOrigin =
    SOCIAL_PROVIDERS.map((provider) => oauthConfig(provider)?.origin).find(Boolean) || '';
  const readyProviders = SOCIAL_PROVIDERS.filter((p) => oauthConfig(p) !== null);
  return (
    <Auth
      initialError={error || ''}
      authOrigin={authOrigin}
      readyProviders={[...readyProviders]}
      next="/library"
    />
  );
}
