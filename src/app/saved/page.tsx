import { Suspense } from 'react';
import Library from '@/features/Library';
export const metadata = { title: 'مجموعتك — ردودك المحفوظة', robots: { index: false } };
export default function Page() {
  return (
    <Suspense fallback={<div className="container page-section skeleton">نجهّز مجموعتك...</div>}>
      <Library savedOnly />
    </Suspense>
  );
}
