import Link from 'next/link';
import { StatePanel } from '@/components/ui/StatePanel';

export default function NotFound() {
  return (
    <section className="container page-section">
      <StatePanel
        kind="not-found"
        title="الصفحة غير موجودة"
        description="لم نجد الصفحة أو الرياكشن بهذا الرابط. يمكنك العودة إلى المكتبة."
        action={
          <Link className="btn btn-dark" href="/library">
            العودة إلى المكتبة
          </Link>
        }
      />
    </section>
  );
}
