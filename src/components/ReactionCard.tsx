'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Reaction } from '@/lib/reactions';
import { verifiedMediaType, videoSeconds } from '@/lib/media';
import { useApp } from './AppProvider';
import { ReactionMenu } from './ReactionMenu';

/** A card is only media, verified video seconds, its primary title and an actions menu. */
export function ReactionCard({
  reaction,
  savedView = false,
}: {
  reaction: Reaction;
  index?: number;
  savedView?: boolean;
}) {
  const app = useApp();
  const [ratio, setRatio] = useState<number>();
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const kind = verifiedMediaType(reaction);
  const isVideo = kind === 'video';
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (hovered && !app.reduced && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.play().catch(() => setPlaying(false));
    } else {
      element.pause();
      if (element.readyState > 0) element.currentTime = 0;
      setPlaying(false);
    }
  }, [hovered, app.reduced]);
  function startPreview(event: React.PointerEvent<HTMLAnchorElement>) {
    if (
      isVideo &&
      event.pointerType === 'mouse' &&
      !app.reduced &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches &&
      matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      setHovered(true);
  }
  return (
    <article className={`reaction-card${savedView ? ' saved-card' : ''}`} data-media-type={kind}>
      <div className="card-visual" style={savedView && ratio ? { aspectRatio: ratio } : undefined}>
        <Link
          className="card-preview"
          href={`/r/${encodeURIComponent(reaction.code)}`}
          aria-label={`${reaction.caption} — عرض التفاصيل`}
          onPointerEnter={startPreview}
          onPointerLeave={() => {
            setHovered(false);
            setPlaying(false);
          }}
        >
          <Image
            src={kind === 'image' ? reaction.media : reaction.poster}
            alt=""
            fill
            sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 290px"
            loading="lazy"
            className="card-image"
            onLoad={
              savedView
                ? (event) => {
                    const image = event.currentTarget;
                    if (image.naturalHeight > 0)
                      setRatio(
                        Math.max(0.68, Math.min(1.6, image.naturalWidth / image.naturalHeight)),
                      );
                  }
                : undefined
            }
          />
          {isVideo && (
            <video
              ref={video}
              className={`card-hover-video${playing ? ' is-playing' : ''}`}
              src={reaction.media}
              poster={reaction.poster}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
              tabIndex={-1}
              onPlaying={() => setPlaying(true)}
              onError={() => {
                setPlaying(false);
                setHovered(false);
              }}
            />
          )}
          {isVideo && videoSeconds(reaction.duration) && (
            <span className="card-duration mono" dir="ltr" aria-hidden="true">
              {videoSeconds(reaction.duration)}
            </span>
          )}
        </Link>
      </div>
      <div className="card-info">
        <Link
          href={`/r/${encodeURIComponent(reaction.code)}`}
          className="card-title"
          title={reaction.caption}
        >
          {reaction.caption}
        </Link>
        <ReactionMenu reaction={reaction} />
      </div>
    </article>
  );
}
