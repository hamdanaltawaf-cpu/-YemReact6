'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bookmark,
  SlidersHorizontal,
  Search,
  Menu,
  X,
  Bell,
  ArrowUpLeft,
  LogOut,
} from 'lucide-react';
import { Qusasa } from './Qusasa';
import { useApp } from './AppProvider';
import { Modal } from './ui/Modal';
export function Header() {
  const path = usePathname(),
    app = useApp();
  const [menu, setMenu] = useState(false),
    [notifications, setNotifications] = useState(false);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        const input = document.querySelector<HTMLInputElement>('[data-search]');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  const links = [
    ['/library', 'المكتبة'],
    ['/saved', 'مجموعتك'],
    ['/about', 'حكايتنا'],
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        انتقل إلى المحتوى
      </a>
      <header className="site-header">
        <div className="container header-row">
          <Link href="/" className="brand" aria-label="يمن رياكت. YEMREACT — الرئيسية">
            <Qusasa size={38} />
            <span>
              <b>
                يمن رياكت<span className="brand-dot">.</span>
              </b>
              <small>YEMREACT</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="التنقل الرئيسي">
            {links.map(([href, label]) => (
              <Link aria-current={path === href ? 'page' : undefined} key={href} href={href}>
                {label}
              </Link>
            ))}
            <Link href="/admin" aria-current={path === '/admin' ? 'page' : undefined}>
              الاستوديو <span className="tiny-tag">جديد</span>
            </Link>
          </nav>
          <div className="header-actions">
            <button
              className="icon-btn"
              aria-label="تخصيص المظهر"
              onClick={() => app.setSettings(true)}
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              className="icon-btn notification-trigger"
              aria-label="الإشعارات"
              onClick={() => setNotifications(true)}
            >
              <Bell size={18} />
              {app.notices.length > 0 && <i />}
            </button>
            {app.user ? (
              <button className="account-chip" onClick={app.logout} title="تسجيل الخروج">
                <span>{app.user.name.slice(0, 1)}</span>
                <LogOut size={15} />
              </button>
            ) : (
              <Link href="/login" className="btn btn-dark btn-small login-link">
                دخول <ArrowUpLeft size={15} />
              </Link>
            )}
            <button
              className="icon-btn mobile-menu"
              aria-expanded={menu}
              aria-controls="mobile-nav"
              aria-label={menu ? 'إغلاق القائمة' : 'فتح القائمة'}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav container" id="mobile-nav" aria-label="تنقل الهاتف">
            {links.map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
            <Link href="/admin">الاستوديو</Link>
            <Link href="/login">الحساب</Link>
          </nav>
        )}
      </header>
      <Modal open={notifications} onClose={() => setNotifications(false)} title="آخر نشاطك">
        <p className="muted">إشعارات هذه الجلسة فقط، بلا رسائل تسويقية.</p>
        {app.notices.length ? (
          <>
            <ul className="notice-list">
              {app.notices.map((n) => (
                <li key={n.id}>
                  <span>{n.text}</span>
                  <time>
                    {new Date(n.time).toLocaleTimeString('ar', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
            <button className="btn btn-outline" onClick={app.clearNotices}>
              مسح الإشعارات
            </button>
          </>
        ) : (
          <div className="empty-small">
            <Bell size={32} />
            <p>كل شيء هادئ هنا.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
