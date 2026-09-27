'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CircleHelp,
  Library,
  Layers3,
  LogOut,
  Plus,
  Search,
  Settings2,
  UserRound,
} from 'lucide-react';
import { Qusasa } from './Qusasa';
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

function AccountActions({ dismiss }: { dismiss: () => void }) {
  const app = useApp();
  const contribution = useContribution();
  const router = useRouter();
  const path = usePathname();

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
      <nav className="account-actions-list" aria-label="خيارات الحساب">
        <button
          type="button"
          onClick={() => {
            dismiss();
            app.setSettings(true);
          }}
        >
          <Settings2 size={19} aria-hidden="true" /> الإعدادات
        </button>
        <Link href="/login" onClick={dismiss}>
          <UserRound size={19} aria-hidden="true" /> الحساب
        </Link>
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
      {!app.user && !contribution.mockSignedIn && (
        <p className="account-guest-note">لست مسجّلًا؟ افتح «الحساب» لاختيار خدمة الدخول.</p>
      )}
    </>
  );
}

export function Header() {
  const path = usePathname();
  const router = useRouter();
  const app = useApp();
  const [accountPopover, setAccountPopover] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const accountArea = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAccountPopover(false);
    setAccountSheet(false);
    setSearchOpen(false);
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
      setSearchOpen(false);
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
      event.preventDefault();
      if (breakpoint.matches)
        document.querySelector<HTMLInputElement>('#desktop-library-search')?.focus();
      else {
        setHiddenOnScroll(false);
        setSearchOpen(true);
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
          searchOpen ||
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
  }, [app.reduced, accountSheet, searchOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchOpen(false);
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
            <form
              className="desktop-library-search"
              role="search"
              aria-label="بحث في المكتبة"
              onSubmit={submitSearch}
            >
              <label className="sr-only" htmlFor="desktop-library-search">
                ابحث في المكتبة
              </label>
              <input
                id="desktop-library-search"
                type="search"
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث في المكتبة"
                autoComplete="off"
              />
              <button type="submit" aria-label="تنفيذ البحث" title="ابحث في المكتبة">
                <Search size={18} aria-hidden="true" />
              </button>
            </form>
            <button
              type="button"
              className="icon-btn mobile-search-trigger"
              aria-label="البحث"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
              onClick={() => {
                setHiddenOnScroll(false);
                setSearchOpen(true);
              }}
            >
              <Search size={21} aria-hidden="true" />
            </button>
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
                  <div className="account-popover-heading">
                    <strong>{app.user?.name || 'مساحتك'}</strong>
                    <span>{app.user ? 'حسابك' : 'تصفّح كزائر'}</span>
                  </div>
                  <AccountActions dismiss={() => setAccountPopover(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="التنقل الأساسي للهاتف">
        {primaryLinks.slice(0, 2).map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={isCurrent(path, href) ? 'page' : undefined}>
            <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
        <UploadQuickAction mobile />
        <Link href="/saved" aria-current={isCurrent(path, '/saved') ? 'page' : undefined}>
          <Bookmark size={20} strokeWidth={1.9} aria-hidden="true" />
          <span>المحفوظات</span>
        </Link>
        <button
          type="button"
          className="mobile-account-tab"
          aria-label="الحساب"
          aria-haspopup="dialog"
          aria-expanded={accountSheet}
          onClick={openAccount}
        >
          <UserRound size={20} strokeWidth={1.9} aria-hidden="true" />
          <span>الحساب</span>
        </button>
      </nav>

      <Modal open={accountSheet} onClose={() => setAccountSheet(false)} title="الحساب" sheet>
        <div className="account-sheet-intro">
          <strong>{app.user?.name || 'أهلًا بك'}</strong>
          <p>
            {app.user
              ? 'إعداداتك وروابط حسابك في مكان واحد.'
              : 'تصفّح بحرية، أو افتح الحساب للدخول.'}
          </p>
        </div>
        <AccountActions dismiss={() => setAccountSheet(false)} />
      </Modal>
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="البحث" sheet>
        <form
          className="mobile-library-search"
          role="search"
          aria-label="بحث في المكتبة"
          onSubmit={submitSearch}
        >
          <label htmlFor="mobile-library-search">ابحث في المكتبة</label>
          <div>
            <Search size={19} aria-hidden="true" />
            <input
              id="mobile-library-search"
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="اكتب كلمة أو عبارة"
              autoComplete="off"
              autoFocus
            />
            <button type="submit" className="btn btn-primary">
              بحث <ArrowLeft size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
