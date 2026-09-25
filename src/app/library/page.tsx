import { Suspense } from 'react';
import LibraryFeed from '@/features/LibraryFeed';
import Loading from './loading';
export const metadata = {
  alternates: { canonical: '/library' },
  title: 'المكتبة — رياكشنات يمنية',
  description: 'تصفّح مكتبة رياكشنات يمنية من الصور والفيديوهات في عرض بصري بسيط.',
};
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <LibraryFeed />
    </Suspense>
  );
}
