'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { ReactionMasonry } from '@/components/ReactionMasonry';
import { StatePanel } from '@/components/ui/StatePanel';
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
  const emptyHref = query.trim()
    ? (() => {
        const remaining = new URLSearchParams(params.toString());
        remaining.delete('q');
        const search = remaining.toString();
        return search ? `/library?${search}` : '/library';
      })()
    : '/library';
  return (
    <section className="container library-feed" aria-label="المكتبة">
      <h1 className="sr-only">المكتبة</h1>
      {items.length > 0 && <ReactionMasonry items={items} />}
      <StatePanel
        kind="empty"
        visible={items.length === 0}
        heading="h2"
        title={query.trim() ? `ما لقينا نتائج لـ «${query.trim()}»` : 'ما فيه رياكشنات هنا حاليًا'}
        description={
          query.trim()
            ? 'جرّب كلمات ثانية أو امسح البحث للعودة إلى نتائج المكتبة.'
            : 'غيّر الاختيار أو ارجع للمكتبة كاملة لاستكشاف الرياكشنات.'
        }
        action={
          <Link className="btn btn-outline" href={emptyHref}>
            {query.trim() ? 'مسح البحث' : 'عرض المكتبة كاملة'}
          </Link>
        }
      />
    </section>
  );
}
