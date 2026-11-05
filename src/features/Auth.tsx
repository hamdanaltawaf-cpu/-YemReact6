'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpLeft,
  ShieldCheck,
  Bookmark,
  Check,
  Globe2,
  UserRound,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';

import { SocialIcon } from '@/components/SocialIcon';
import { GUEST_COOKIE } from '@/lib/gate';
import { SOCIAL_PROVIDERS, SOCIAL_NAMES, type SocialProvider } from '@/lib/social';

export default function Auth({
  initialError = '',
  authOrigin = '',
  readyProviders = [],
  next = '/library',
}: {
  initialError?: string;
  authOrigin?: string;
  readyProviders?: SocialProvider[];
  next?: string;
}) {
  const app = useApp();
  const router = useRouter();
  // Native new-tab links avoid blocked top navigation in embedded previews.
  // The server supplies only the canonical public origin, never provider secrets.
  const [embedded, setEmbedded] = useState(true);
  const [attempt, setAttempt] = useState<SocialProvider | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => {
    setEmbedded(window.self !== window.top);
    const clear = () => {
      setAttempt(null);
      setCopyStatus('');
    };
    window.addEventListener('pageshow', clear);
    return () => window.removeEventListener('pageshow', clear);
  }, []);
  const providerUrl = (provider: SocialProvider) => `${authOrigin}/api/auth/oauth/${provider}`;
  // البطاقة بلا مفاتيح لا تكون رابطًا: الجاهزية تقرار على الخادم حصرًا.
  const ready = (provider: SocialProvider) => readyProviders.includes(provider);
  const availableProviders = SOCIAL_PROVIDERS.filter(ready);
  const pendingProviders = SOCIAL_PROVIDERS.filter((provider) => !ready(provider));
  const pendingCount = pendingProviders.length;
  const renderProvider = (provider: SocialProvider) =>
    ready(provider) ? (
      <a
        key={provider}
        className={`social-provider social-provider-${provider}`}
        href={providerUrl(provider)}
        target={embedded ? '_blank' : '_self'}
        rel="noopener noreferrer"
        onClick={() => {
          if (embedded) {
            setAttempt(provider);
            setCopyStatus('');
          }
        }}
      >
        <SocialIcon provider={provider} />
        <span>
          تسجيل باستخدام <bdi>{SOCIAL_NAMES[provider]}</bdi>
        </span>
        <ArrowUpLeft size={17} className="social-provider-arrow" aria-hidden="true" />
      </a>
    ) : (
      <div
        key={provider}
        className={`social-provider social-provider-pending social-provider-${provider}`}
        aria-disabled="true"
      >
        <SocialIcon provider={provider} />
        <span>
          تسجيل باستخدام <bdi>{SOCIAL_NAMES[provider]}</bdi>
          <small>يُفتح بعد إضافة مفاتيح الخدمة</small>
        </span>
        <span className="social-provider-badge">قيد التجهيز</span>
      </div>
    );
  function continueAsGuest() {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${GUEST_COOKIE}=1; path=/; SameSite=Lax${secure}`; // كوكي جلسة: بلا Max-Age
    router.push(next);
  }
  async function copyLoginLink() {
    if (!attempt) return;
    const url = new URL(providerUrl(attempt), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('تم نسخ رابط الدخول. افتحه في تبويب مستقل.');
    } catch {
      setCopyStatus('يمكنك نسخ الرابط أدناه وفتحه مباشرة في المتصفح.');
    }
  }
  if (app.user)
    return (
      <section className="container page-section empty-state">
        <ShieldCheck size={50} />
        <h1>حيّاك، {app.user.name}.</h1>
        <p>حسابك متصل. المحفوظات جاهزة لك.</p>
        <Link className="btn btn-dark" href={app.user.role === 'admin' ? '/admin' : '/saved'}>
          افتح {app.user.role === 'admin' ? 'الاستوديو' : 'المحفوظات'} <ArrowLeft size={18} />
        </Link>
        <button className="text-button" onClick={app.logout}>
          تسجيل الخروج
        </button>
      </section>
    );
  return (
    <section className="container auth-section social-auth" aria-labelledby="social-title">
      <div className="auth-story">
        <Bookmark size={42} aria-hidden="true" />
        <span className="eyebrow">كل ردودك. معك.</span>
        <h1 id="social-title">
          مع حسابك، <br />
          محفوظاتك معك.
        </h1>
        <p>
          تصل إلى محفوظاتك من أجهزتك عند تسجيل الدخول.
          <br />
          كزائر، تبقى على هذا الجهاز.
        </p>
        <ul className="social-benefits">
          <li>
            <Bookmark size={18} />
            <span>ردودك المفضّلة في مكان واحد</span>
          </li>
          <li>
            <Globe2 size={18} />
            <span>مع حسابك، على الجوال والويب.</span>
          </li>
          <li>
            <Check size={18} />
            <span>بلا متابعين. بلا زحمة.</span>
          </li>
        </ul>
        <span className="social-story-signature mono" aria-hidden="true">
          YOUR REACTIONS. YOUR SPACE. ↗
        </span>
      </div>
      <div className="auth-form-wrap social-panel">
        <span className="eyebrow">أهلًا بأهل الردود الحلوة</span>
        <h2>حيّاك. بطريقتك.</h2>
        <p className="social-intro">اختر طريقة المتابعة المناسبة لك.</p>
        <p className="social-intro social-sync-note">
          مع الحساب، تصل لمحفوظاتك من أجهزتك. كزائر، تبقى على هذا الجهاز فقط.
        </p>
        {availableProviders.length > 0 && (
          <div className="social-providers" role="group" aria-label="خدمات الدخول المتاحة">
            {availableProviders.map(renderProvider)}
          </div>
        )}
        <Link
          href={next}
          className="social-guest-card"
          onClick={continueAsGuest}
          aria-label="الاستمرار كزائر بلا حساب"
        >
          <UserRound size={19} aria-hidden="true" />
          <span>
            <b>الاستمرار كزائر</b>
            <small>بلا حساب. محفوظاتك تبقى على هذا الجهاز.</small>
          </span>
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>
        {pendingProviders.length > 0 && (
          <div className="social-providers" role="group" aria-label="خدمات قيد التجهيز">
            {pendingProviders.map(renderProvider)}
          </div>
        )}
        {pendingCount > 0 && (
          <p className="social-pending-note">
            {pendingCount === SOCIAL_PROVIDERS.length
              ? 'الدخول بالحساب قيد التجهيز — ويمكنك الاستمرار كزائر الآن، ويبقى ما تحفظه على جهازك.'
              : 'الدخول متاح عبر الخدمات المفعّلة أعلاه. والبقية تُفتح تباعًا.'}
          </p>
        )}
        {attempt && (
          <div className="social-login-help">
            <p role="status">
              أكمل الدخول في التبويب الجديد. إن لم يظهر، انسخ رابط الدخول وافتحه في المتصفح.
            </p>
            <button type="button" className="text-button" onClick={copyLoginLink}>
              نسخ رابط الدخول
            </button>
            {copyStatus && (
              <>
                <p role="status">{copyStatus}</p>
                <a dir="ltr" href={providerUrl(attempt)} target="_blank" rel="noopener noreferrer">
                  {providerUrl(attempt)}
                </a>
              </>
            )}
          </div>
        )}
        {initialError && (
          <p className="form-error social-error" role="alert">
            {initialError}
          </p>
        )}
        <div className="social-trust">
          <ShieldCheck size={21} aria-hidden="true" />
          <p>
            التحقق يتم لدى الخدمة التي تختارها.
            <br />
            <span>لا ننشر أي شيء نيابةً عنك.</span>
          </p>
        </div>
        <p className="social-privacy">
          باستمرارك، أنت توافق على <Link href="/privacy">سياسة الخصوصية والحقوق</Link>.
        </p>
      </div>
    </section>
  );
}
