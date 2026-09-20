'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Qusasa } from './Qusasa';
import { ArrowUpLeft, MoveUp } from 'lucide-react';
export function Footer() {
  const pathname = usePathname();
  if (['/library', '/library/', '/login', '/login/'].includes(pathname)) return null;

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <div className="footer-kicker">كلمة بصرية. بلهجتنا.</div>
            <h2>
              خذها. حطها. <em>يمنية.</em>
            </h2>
            <p>لأن بعض المواقف... ما يردّ عليها إلا رياكشن يمني.</p>
          </div>
          <Link className="footer-circle" href="/library" aria-label="تصفح المكتبة">
            <ArrowUpLeft size={44} />
          </Link>
        </div>
        <div className="footer-bottom">
          <Link href="/" className="brand">
            <Qusasa size={28} />
            <b>يمن رياكت.</b>
          </Link>
          <nav aria-label="روابط التذييل">
            <Link href="/about">حكايتنا</Link>
            <Link href="/about#faq">أسئلة تتكرر</Link>
            <Link href="/about#privacy">الخصوصية والحقوق</Link>
            <Link href="/admin">الاستوديو</Link>
          </nav>
          <span className="mono">صُنع بروح يمنية ↗</span>
        </div>
        <div className="footer-note">
          <span>YEMREACT © 2026</span>
          <span>نسخة تجريبية • الصور مولّدة واللقطات نماذج متحركة.</span>
          <a href="#top" aria-label="العودة إلى الأعلى">
            <MoveUp size={15} />
          </a>
        </div>
      </div>
    </footer>
  );
}
