import { Suspense } from 'react';
import type { Metadata } from 'next';
import LibraryFeed from '@/features/LibraryFeed';
import Loading from './loading';

/** DECISION-5.1: البحث حالة من المكتبة عبر ?q= — لا صفحة مستقلة. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}): Promise<Metadata> {
  const { q = '' } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : (q ?? '')).trim();
  return {
    alternates: { canonical: '/library' },
    title: 'المكتبة — رياكشنات يمنية',
    description: 'تصفّح مكتبة رياكشنات يمنية من الصور والفيديوهات في عرض بصري بسيط.',
    // نتائج البحث الداخلية لا تُفهرس (درس Giphy) — لكن روابطها تبقى قابلة للمتابعة.
    ...(query ? { robots: { index: false, follow: true } } : {}),
  };
}
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <LibraryFeed />
    </Suspense>
  );
}
