'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useApp } from './AppProvider';
export function Footer() {
  const pathname = usePathname();
  const { user } = useApp();
  const path = pathname.replace(/\/$/, '') || '/';
  if (['/library', '/login', '/saved'].includes(path)) return null;
  return (
    <footer className="site-footer">
      <div className="container compact-footer-row">
        <span className="footer-wordmark">YemReact</span>
        <nav aria-label="المعلومات والمساعدة">
          {path !== '/help' && <Link href="/help">المساعدة</Link>}
          {path !== '/privacy' && (
            <Link href="/privacy" id={path === '/help' ? 'privacy' : undefined}>
              الخصوصية وحقوق المحتوى
            </Link>
          )}
          {user?.role === 'admin' && <Link href="/admin">الاستوديو</Link>}
        </nav>
      </div>
    </footer>
  );
}
