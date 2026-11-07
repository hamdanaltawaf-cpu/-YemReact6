'use client';
import { StatePanel } from '@/components/ui/StatePanel';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="container page-section">
      <StatePanel
        kind="error"
        title="تعذّر تحميل الصفحة"
        description="حاول تحميل الصفحة مرة أخرى. إذا استمرت المشكلة، جرّب لاحقًا."
        action={
          <button className="btn btn-dark" onClick={reset}>
            إعادة المحاولة
          </button>
        }
      />
    </section>
  );
}
