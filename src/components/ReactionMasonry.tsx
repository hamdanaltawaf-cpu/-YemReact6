'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Reaction } from '@/lib/reactions';
import { ReactionCard } from './ReactionCard';
const PAGE_SIZE = 8;
export function ReactionMasonry({
  items,
  savedView = false,
}: {
  items: Reaction[];
  savedView?: boolean;
}) {
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
    <>
      <div className="library-masonry" ref={grid}>
        {visible.map((reaction, index) => (
          <div className="library-pin" key={reaction.code}>
            <ReactionCard reaction={reaction} index={index} savedView={savedView} />
          </div>
        ))}
      </div>
      {hasMore && <div className="library-sentinel" ref={sentinel} aria-hidden="true" />}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {hasMore
          ? 'تظهر المزيد تلقائيًا عند التمرير.'
          : savedView
            ? 'تم عرض جميع المحفوظات.'
            : 'تم عرض جميع الرياكشنات.'}
      </p>
    </>
  );
}
