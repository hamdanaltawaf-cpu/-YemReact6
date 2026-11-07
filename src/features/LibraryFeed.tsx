'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { ReactionMasonry } from '@/components/ReactionMasonry';
import { StatePanel } from '@/components/ui/StatePanel';
import { filterReactions } from '@/lib/reactions';
import { CAT_BY_ID } from '@/lib/categories';

/** A content-first, non-paginated masonry view. Old search URLs still resolve. */
export default function LibraryFeed() {
  const { reactions } = useApp();
  const params = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('cat') || '';
  const categoryName = CAT_BY_ID[category]?.name;
  const activeQuery = query.trim();
  const hasCategory = !!category;
  const hasActiveFilters = !!activeQuery || !!category;
  const items = useMemo(
    () => filterReactions(reactions, query, category),
    [reactions, query, category],
  );
  const clearFiltersHref = (() => {
    const remaining = new URLSearchParams(params.toString());
    remaining.delete('q');
    remaining.delete('cat');
    const search = remaining.toString();
    return search ? `/library?${search}` : '/library';
  })();
  const categoryContext = categoryName
    ? ` ضمن تصنيف «${categoryName}»`
    : hasCategory
      ? ' ضمن تصنيف غير معروف'
      : '';
  const emptyTitle = activeQuery
    ? `ما لقينا نتائج لـ «${activeQuery}»${categoryContext}`
    : categoryName
      ? `ما لقينا نتائج ضمن تصنيف «${categoryName}»`
      : category
        ? 'ما لقينا نتائج ضمن هذا التصنيف'
        : 'ما فيه رياكشنات هنا حاليًا';
  return (
    <section className="container library-feed" aria-label="المكتبة">
      <h1 className="sr-only">المكتبة</h1>
      {hasActiveFilters && (
        <div className="library-results-context">
          <p role="status" aria-live="polite">
            {activeQuery && <span>البحث: «{activeQuery}»</span>}
            {activeQuery && hasCategory && <span aria-hidden="true"> · </span>}
            {hasCategory && <span>التصنيف: {categoryName || 'غير معروف'}</span>}
            {activeQuery || hasCategory ? <span> · </span> : null}
            <strong>عدد النتائج: {items.length}</strong>
          </p>
          {items.length > 0 && (
            <Link className="library-results-clear" href={clearFiltersHref}>
              مسح البحث والفلاتر
            </Link>
          )}
        </div>
      )}
      {items.length > 0 && <ReactionMasonry items={items} />}
      <StatePanel
        kind="empty"
        visible={items.length === 0}
        heading="h2"
        title={emptyTitle}
        description={
          hasActiveFilters
            ? 'جرّب كلمات أو تصنيفًا آخر، أو امسح البحث والفلاتر للعودة إلى المكتبة كاملة.'
            : 'ارجع للمكتبة كاملة لاستكشاف الرياكشنات.'
        }
        action={
          <Link className="btn btn-outline" href={hasActiveFilters ? clearFiltersHref : '/library'}>
            {hasActiveFilters ? 'مسح البحث والفلاتر' : 'عرض المكتبة كاملة'}
          </Link>
        }
      />
    </section>
  );
}
