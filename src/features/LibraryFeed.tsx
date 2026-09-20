'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { ReactionMasonry } from '@/components/ReactionMasonry';
import { filterReactions } from '@/lib/reactions';

/** The public library remains a card-only feed. */
export default function LibraryFeed() {
  const { reactions } = useApp();
  const params = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('cat') || '';
  const items = useMemo(
    () => filterReactions(reactions, query, category),
    [reactions, query, category],
  );
  const filtered = Boolean(query || category);
  return (
    <section className="container library-feed" aria-label="المكتبة">
      <h1 className="sr-only">المكتبة</h1>
      {items.length ? (
        <ReactionMasonry key={JSON.stringify([query, category])} items={items} />
      ) : (
        <div className="empty-state">
          <h2>{filtered ? 'ما لقينا رياكشن لهذا البحث.' : 'الرياكشنات بتوصل قريب.'}</h2>
          {filtered && (
            <Link className="text-button" href="/library">
              تصفّح كل الرياكشنات
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
