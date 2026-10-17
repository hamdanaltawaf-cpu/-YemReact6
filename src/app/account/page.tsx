import type { Metadata } from 'next';
import { AccountSurface } from '@/components/AccountSurface';
import { oauthConfig } from '@/server/oauth-config';
import { SOCIAL_PROVIDERS } from '@/lib/social';

export const metadata: Metadata = { title: 'حسابك' };

/**
 * صفحة الحساب — خدمة ذاتية للزائر أو لصاحب الحساب الحالي حصرًا، لا ملفات عامة.
 * تفتحها خانة «الحساب» من الشريط السفلي على الهاتف (صفحة كاملة لا ورقة).
 * البوابة لا تتغير: من بلا كوكي يُحال إلى صفحة الدخول كما بقية المحتوى.
 */
export default function AccountPage() {
  return (
    <section className="container account-page" aria-labelledby="account-title">
      <div className="page-head">
        <span className="eyebrow">مساحتك الشخصية</span>
        <h1 id="account-title">حسابك</h1>
      </div>
      <AccountSurface
        googleAuthOrigin={oauthConfig('google')?.origin || ''}
        readyProviders={SOCIAL_PROVIDERS.filter((provider) => oauthConfig(provider) !== null)}
      />
    </section>
  );
}
