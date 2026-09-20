import { Suspense } from 'react';
import LibraryFeed from '@/features/LibraryFeed';
import Loading from './loading';
export const metadata = {
  alternates: { canonical: '/library' },
  title: 'المكتبة — لكل موقف رياكشن',
  description: 'تصفّح رياكشنات يمنية بالموقف في مكتبة بصرية، مع المزيد تلقائيًا عند التمرير.',
};
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <LibraryFeed />
    </Suspense>
  );
}
