'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CircleHelp,
  Clapperboard,
  Library,
  Layers3,
  LogOut,
  Plus,
  Search,
  Settings2,
  UserRound,
} from 'lucide-react';
import { Qusasa } from './Qusasa';
import { SocialIcon } from './SocialIcon';
import { isGatewayPath } from '@/lib/chrome';
import type { SocialProvider } from '@/lib/social';
import { GlassNav } from './glass-nav/GlassNav';
import { useApp } from './AppProvider';
import { useContribution } from './ContributionProvider';
import { Modal } from './ui/Modal';

// The upload action and account controls are deliberately not primary tabs.
const primaryLinks = [
  { href: '/library', label: 'المكتبة', Icon: Library },
  { href: '/collections', label: 'المجموعات', Icon: Layers3 },
  { href: '/saved', label: 'المحفوظات', Icon: Bookmark },
] as const;

function isCurrent(path: string, href: string) {
  if (href === '/library') return path === href || path.startsWith('/r/');
  return path === href || (href === '/collections' && path.startsWith('/collections/'));
}

function UploadQuickAction({ mobile = false }: { mobile?: boolean }) {
  return (
    <Link
      href="/contribute"
      className={mobile ? 'mobile-quick-action' : 'desktop-quick-action'}
      aria-label="رفع رياكشن — تجربة محلية"
      title="رفع رياكشن — تجربة محلية بدون نشر فعلي"
    >
      {mobile ? (
        <>
          <span className="mobile-upload-symbol" aria-hidden="true">
            <Plus size={27} strokeWidth={2.25} />
          </span>
          <span>رفع</span>
        </>
      ) : (
        <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
      )}
    </Link>
  );
}

function AccountActions({
  dismiss,
  googleAuthOrigin,
  embedded,
  readyProviders = [],
}: {
  dismiss: () => void;
  googleAuthOrigin: string;
  embedded: boolean;
  /** خدمات الدخول الجاهزة بالمفاتيح — يحدّدها الخادم حصرًا. */
  readyProviders?: readonly SocialProvider[];
}) {
  const app = useApp();
  const contribution = useContribution();
  const router = useRouter();
  const path = usePathname();
  const googleLogin = `${googleAuthOrigin}/api/auth/oauth/google`;

  async function signOut() {
    dismiss();
    if (app.user) {
      if (await app.logout()) {
        if (contribution.mockSignedIn) contribution.endMockSession();
        if (path === '/admin') router.replace('/library');
      }
    } else {
      contribution.endMockSession();
      app.toast('انتهت جلسة التجربة على هذا المتصفح.');
    }
  }

  return (
    <>
      <div className="account-popover-heading">
        {app.user ? (
          <div className="account-profile">
            <span className="account-profile-avatar" aria-hidden="true">
              {app.user.name.trim().slice(0, 1) || <UserRound size={18} />}
            </span>
            <div className="account-profile-copy">
              <strong>{app.user.name}</strong>
              <span className="account-profile-email" dir="ltr" title={app.user.email}>
                {app.user.email}
              </span>
            </div>
          </div>
        ) : (
          <div className="account-guest-heading">
            <UserRound size={22} aria-hidden="true" />
            <div>
              <strong>أنت زائر</strong>
              <p>
                سجّل لحفظ رياكشناتك
                <br />
                والوصول من أي جهاز
              </p>
            </div>
          </div>
        )}
        {app.user?.role === 'admin' && <span className="account-role-badge">ADMIN</span>}
      </div>
      <nav className="account-actions-list" aria-label="خيارات الحساب">
        {!app.user &&
          (readyProviders.includes('google') ? (
            <a
              className="account-google-action"
              href={googleLogin}
              target={embedded ? '_blank' : undefined}
              rel={embedded ? 'noopener noreferrer' : undefined}
              onClick={dismiss}
            >
              <SocialIcon provider="google" /> الدخول بـ Google
            </a>
          ) : (
            <Link
              href="/login"
              className="account-google-action account-google-pending"
              onClick={dismiss}
            >
              <SocialIcon provider="google" /> الدخول بالحساب{' '}
              <span className="account-pending-chip">قيد التجهيز</span>
            </Link>
          ))}
        {app.user?.role === 'admin' && (
          <Link href="/admin" className="account-studio-action" onClick={dismiss}>
            <Clapperboard size={19} aria-hidden="true" /> الاستوديو
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            dismiss();
            app.setSettings(true);
          }}
        >
          <Settings2 size={19} aria-hidden="true" /> الإعدادات
        </button>
        <Link href="/help" onClick={dismiss}>
          <CircleHelp size={19} aria-hidden="true" /> المساعدة
        </Link>
        {(app.user || contribution.mockSignedIn) && (
          <button type="button" className="account-signout" onClick={signOut}>
            <LogOut size={19} aria-hidden="true" />{' '}
            {app.user ? 'تسجيل الخروج' : 'إنهاء جلسة التجربة'}
          </button>
        )}
      </nav>
    </>
  );
}

export function Header({
  googleAuthOrigin = '',
  readyProviders = [],
}: {
  googleAuthOrigin?: string;
  /** خدمات الدخول الجاهزة بالمفاتيح — يحدّدها الخادم حصرًا. */
  readyProviders?: readonly SocialProvider[];
}) {
  const path = usePathname();
  const router = useRouter();
  const app = useApp();
  const [accountPopover, setAccountPopover] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [searchFocus, setSearchFocus] = useState(false);
  const [query, setQuery] = useState('');
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const accountArea = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => setEmbedded(window.self !== window.top), []);

  useEffect(() => {
    setAccountPopover(false);
    setAccountSheet(false);
    setSearchFocus(false);
    setHiddenOnScroll(false);
    const syncQuery = () =>
      setQuery(
        path === '/library' ? new URLSearchParams(window.location.search).get('q') || '' : '',
      );
    syncQuery();
    window.addEventListener('popstate', syncQuery);
    return () => window.removeEventListener('popstate', syncQuery);
  }, [path]);

  useEffect(() => {
    if (!accountPopover) return;
    const frame = requestAnimationFrame(() =>
      popover.current?.querySelector<HTMLElement>('button, a')?.focus(),
    );
    const outside = (event: PointerEvent) => {
      if (!accountArea.current?.contains(event.target as Node)) setAccountPopover(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountPopover(false);
        accountTrigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountPopover]);

  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 1024px)');
    const closeOnResize = () => {
      setAccountPopover(false);
      setAccountSheet(false);
      setSearchFocus(false);
      setHiddenOnScroll(false);
    };
    breakpoint.addEventListener('change', closeOnResize);
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key !== '/' ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) ||
        document.querySelector('dialog[open]')
      )
        return;
      // الاختصار يستهدف حقل البحث الموجود فقط: بلا حقل (مثل بوّابة الدخول) لا يبتلع المفتاح.
      const field = document.querySelector<HTMLInputElement>('#library-search');
      if (!field) return;
      event.preventDefault();
      if (breakpoint.matches) {
        field.focus();
      } else {
        // حقل واحد داخل الهيدر على الجوال: نُظهر الهيدر إن كان مخفيًا ثم نركّز فيه.
        setHiddenOnScroll(false);
        requestAnimationFrame(() => field.focus());
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => {
      breakpoint.removeEventListener('change', closeOnResize);
      window.removeEventListener('keydown', shortcut);
    };
  }, []);

  useEffect(() => {
    let previous = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (
          !window.matchMedia('(max-width: 1023px)').matches ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
          app.reduced ||
          accountSheet ||
          searchFocus ||
          document.querySelector('dialog[open]')
        ) {
          previous = y;
          setHiddenOnScroll(false);
          return;
        }
        if (y < 80) {
          previous = y;
          setHiddenOnScroll(false);
        } else if (Math.abs(y - previous) > 24) {
          setHiddenOnScroll(y > previous);
          previous = y;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [app.reduced, accountSheet, searchFocus]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/library?q=${encodeURIComponent(term)}` : '/library');
  }

  function openAccount() {
    if (window.matchMedia('(min-width: 1024px)').matches) setAccountPopover((open) => !open);
    else {
      setHiddenOnScroll(false);
      setAccountSheet(true);
    }
  }

  // سطح بوّابة الدخول قائم بذاته: يُخفى رأس الموقع كاملًا (الشعار والبحث والتنقّل وزرّ الحساب)
  // والشريط السفلي داخل العود نفسه. الحارس بعد الـhooks حتى يبقى ترتيبها ثابتًا بين العروض.
  if (isGatewayPath(path)) return null;

  return (
    <>
      <a className="skip-link" href="#main">
        انتقل إلى المحتوى
      </a>
      <header
        className={`site-header${hiddenOnScroll ? ' header-hidden' : ''}`}
        inert={hiddenOnScroll}
        aria-hidden={hiddenOnScroll ? true : undefined}
      >
        <div className="container header-row">
          <Link href="/library" className="brand" aria-label="يمن رياكت. YEMREACT — المكتبة">
            <Qusasa size={38} />
            <span>
              <b>
                يمن رياكت<span className="brand-dot">.</span>
              </b>
              <small>YEMREACT</small>
            </span>
          </Link>

          <form
            className="library-search"
            role="search"
            aria-label="بحث في المكتبة"
            onSubmit={submitSearch}
          >
            <label className="sr-only" htmlFor="library-search">
              ابحث عن رياكشن أو موقف
            </label>
            <Search size={19} aria-hidden="true" />
            <input
              id="library-search"
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="ابحث عن رياكشن أو موقف..."
              autoComplete="off"
            />
            <button type="submit" aria-label="تنفيذ البحث" title="ابحث عن رياكشن أو موقف">
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
          </form>

          <nav className="desktop-nav" aria-label="التنقل الرئيسي">
            {primaryLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent(path, href) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <UploadQuickAction />
            <div
              className="header-account"
              ref={accountArea}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setAccountPopover(false);
              }}
            >
              <button
                ref={accountTrigger}
                type="button"
                className="account-avatar"
                aria-label="فتح قائمة الحساب"
                aria-haspopup="dialog"
                aria-expanded={accountPopover || accountSheet}
                aria-controls={accountPopover ? 'desktop-account-popover' : undefined}
                onClick={openAccount}
              >
                {app.user ? (
                  <span aria-hidden="true">{app.user.name.slice(0, 1)}</span>
                ) : (
                  <UserRound size={20} aria-hidden="true" />
                )}
              </button>
              {accountPopover && (
                <div
                  ref={popover}
                  className="account-popover"
                  id="desktop-account-popover"
                  role="dialog"
                  aria-label="قائمة الحساب"
                >
                  <AccountActions
                    dismiss={() => setAccountPopover(false)}
                    googleAuthOrigin={googleAuthOrigin}
                    embedded={embedded}
                    readyProviders={readyProviders}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* الشريط الزجاجي العائم: المسارات الأربعة روابط، و«الحساب» يفتح قائمة الحساب */}
      <GlassNav onSelect={(key) => key === 'account' && openAccount()} />

      <Modal open={accountSheet} onClose={() => setAccountSheet(false)} title="الحساب" sheet>
        <AccountActions
          dismiss={() => setAccountSheet(false)}
          googleAuthOrigin={googleAuthOrigin}
          embedded={embedded}
          readyProviders={readyProviders}
        />
      </Modal>
    </>
  );
}
