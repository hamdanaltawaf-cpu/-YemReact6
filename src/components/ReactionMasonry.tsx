'use client';
import { useLayoutEffect, useRef } from 'react';
import type { Reaction } from '@/lib/reactions';
import { ReactionCard } from './ReactionCard';

/** Render the whole curated result set at once; no sentinel or automatic pagination. */
export function ReactionMasonry({
  items,
  savedView = false,
}: {
  items: Reaction[];
  savedView?: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);
  // Grid row spans preserve DOM reading and tab order, unlike CSS columns.
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
    element.dataset.masonry = 'true';
    const observer = new ResizeObserver((entries) =>
      entries.forEach((entry) => measure(entry.target)),
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items]);
  return (
    <div className="library-masonry" ref={grid}>
      {items.map((reaction) => (
        <div className="library-pin" key={reaction.code}>
          <ReactionCard reaction={reaction} savedView={savedView} />
        </div>
      ))}
    </div>
  );
}
