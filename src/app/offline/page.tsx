import Link from 'next/link';
import { StatePanel } from '@/components/ui/StatePanel';
export const metadata = { title: 'بدون اتصال', robots: { index: false } };
export default function Page() {
  return (
    <section className="container page-section">
      <StatePanel
        kind="offline"
        title="أنت دون اتصال"
        description="قد تتوفر بعض الصفحات والصور التي زرتها سابقًا، وليس كل المحتوى. تشغيل المقاطع وتسجيل الدخول والمزامنة تحتاج إلى اتصال."
        action={
          <Link href="/library" className="btn btn-dark">
            العودة إلى المكتبة
          </Link>
        }
      />
    </section>
  );
}
