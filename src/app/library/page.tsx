import { Suspense } from 'react';
import Library from '@/features/Library';
export const metadata = {
  alternates: { canonical: '/library' },
  title: 'المكتبة — لكل موقف رياكشن',
  description: 'ابحث بالموقف، صفّ بالفئة والمدة، واعثر على ردّك اليمني.',
};
export default function Page() {
  return (
    <Suspense fallback={<div className="container page-section skeleton">نجهّز المكتبة...</div>}>
      <Library />
    </Suspense>
  );
}
