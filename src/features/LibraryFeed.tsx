'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { ReactionMasonry } from '@/components/ReactionMasonry';
import { filterReactions } from '@/lib/reactions';

/** A content-first, non-paginated masonry view. Old search URLs still resolve. */
export default function LibraryFeed() {
  const { reactions } = useApp();
  const params = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('cat') || '';
  const items = useMemo(
    () => filterReactions(reactions, query, category),
    [reactions, query, category],
  );
  return (
    <section className="container library-feed" aria-label="المكتبة">
      <h1 className="sr-only">المكتبة</h1>
      {items.length > 0 && <ReactionMasonry items={items} />}
    </section>
  );
}
