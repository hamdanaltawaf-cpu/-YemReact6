import Link from 'next/link';
import { WifiOff } from 'lucide-react';
export const metadata = { title: 'بدون اتصال', robots: { index: false } };
export default function Page() {
  return (
    <section className="container page-section empty-state">
      <WifiOff size={50} />
      <h1>النت راح... والردّ ما راح.</h1>
      <p>
        قد تجد الصفحات والصور التي زرتها سابقًا في ذاكرة المتصفح. المقاطع والحساب والإدارة تحتاج
        اتصالًا.
      </p>
      <Link href="/library" className="btn btn-dark">
        جرّب المكتبة المحفوظة
      </Link>
    </section>
  );
}
