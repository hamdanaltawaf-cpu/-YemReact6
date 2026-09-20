'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { ReactionCard } from '@/components/ReactionCard';
import { filterReactions, type Reaction } from '@/lib/reactions';

const PAGE_SIZE = 8;

/** The public library is a card-only feed. Saved collections retain their own controls. */
export default function LibraryFeed() {
  const { reactions } = useApp();
  const params = useSearchParams();
  // Links from home/search still work without reintroducing controls above the feed.
  const query = params.get('q') || '';
  const category = params.get('cat') || '';
  const items = useMemo(
    () => filterReactions(reactions, query, category),
    [reactions, query, category],
  );
  return (
    <ReactionFeed
      key={JSON.stringify([query, category])}
      items={items}
      filtered={Boolean(query || category)}
    />
  );
}

function ReactionFeed({ items, filtered }: { items: Reaction[]; filtered: boolean }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const grid = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const visible = items.slice(0, limit);
  const hasMore = limit < items.length;

  // Grid row spans give a masonry layout without changing DOM/keyboard reading order.
  // Measuring the inner card (not the spanning wrapper) avoids ResizeObserver loops.
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = (card: Element) => {
      const pin = card.parentElement;
      if (!pin) return;
      const gap = parseFloat(getComputedStyle(element).getPropertyValue('--pin-gap')) || 16;
      pin.style.gridRowEnd = `span ${Math.ceil(card.getBoundingClientRect().height + gap)}`;
    };
    const cards = element.querySelectorAll('.reaction-card');
    cards.forEach(measure);
    // Progressive enhancement: a normal grid remains usable without ResizeObserver.
    element.dataset.masonry = 'true';
    const observer = new ResizeObserver((entries) =>
      entries.forEach((entry) => measure(entry.target)),
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [limit, items]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore) return;
    let consumed = false;
    const advance = () => {
      if (consumed) return;
      consumed = true;
      setLimit((current) => Math.min(current + PAGE_SIZE, items.length));
    };
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) advance();
        },
        { rootMargin: '240px 0px', threshold: 0 },
      );
      observer.observe(target);
      return () => observer.disconnect();
    }
    // Older browsers get the same automatic behavior, not a manual button.
    const check = () => {
      if (target.getBoundingClientRect().top <= window.innerHeight + 240) advance();
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [hasMore, limit, items.length]);

  return (
    <section className="container library-feed" aria-label="المكتبة">
      <h1 className="sr-only">المكتبة</h1>
      {items.length ? (
        <>
          <div className="library-masonry" ref={grid}>
            {visible.map((reaction, index) => (
              <div className="library-pin" key={reaction.code}>
                <ReactionCard reaction={reaction} index={index} />
              </div>
            ))}
          </div>
          {hasMore && <div className="library-sentinel" ref={sentinel} aria-hidden="true" />}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {hasMore
              ? 'تظهر المزيد من الرياكشنات تلقائيًا عند التمرير.'
              : 'تم عرض جميع الرياكشنات.'}
          </p>
        </>
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
