import type { Metadata } from 'next';
import { AccountSurface } from '@/components/AccountSurface';
import { oauthConfig } from '@/server/oauth-config';
import { SOCIAL_PROVIDERS } from '@/lib/social';

export const metadata: Metadata = { title: 'حسابك' };

/**
 * صفحة الحساب — خدمة ذاتية للزائر أو لصاحب الحساب الحالي حصرًا، لا ملفات عامة.
 * تفتحها خانة «الحساب» من الشريط السفلي على الهاتف (صفحة كاملة لا ورقة).
 * سطح الزائر ومحفوظاته المحلية متاحان بلا تسجيل أو كوكي؛ بيانات الحساب تحميها واجهات الخادم.
 */
export default function AccountPage() {
  return (
    <section className="container account-page">
      <h1 className="sr-only">الحساب</h1>
      <AccountSurface
        googleAuthOrigin={oauthConfig('google')?.origin || ''}
        readyProviders={SOCIAL_PROVIDERS.filter((provider) => oauthConfig(provider) !== null)}
      />
    </section>
  );
}
