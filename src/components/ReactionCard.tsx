'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, Play, ArrowUpLeft, Expand } from 'lucide-react';
import type { Reaction } from '@/lib/reactions';
import { isImageMedia, isVideoMedia } from '@/lib/media';
import { useApp } from './AppProvider';
export function ReactionCard({
  reaction,
  index = 0,
  savedView = false,
}: {
  reaction: Reaction;
  index?: number;
  savedView?: boolean;
}) {
  const app = useApp(),
    saved = app.saved.includes(reaction.code);
  const [ratio, setRatio] = useState<number>();
  const isVideo = isVideoMedia(reaction.media);
  const isImage = isImageMedia(reaction.media);
  return (
    <article
      className={`reaction-card${savedView ? ' saved-card' : ''}`}
      data-media-type={isVideo ? 'video' : isImage ? 'image' : 'other'}
    >
      <div className="card-visual" style={savedView && ratio ? { aspectRatio: ratio } : undefined}>
        <button
          className="card-preview"
          onClick={() => app.setPreview(reaction.code)}
          title={`معاينة الرياكشن: ${reaction.caption}`}
        >
          <span className="sr-only">معاينة الرياكشن: {savedView ? reaction.caption : ''}</span>
          <Image
            src={isImage ? reaction.media : reaction.poster}
            alt={
              reaction.isDemo
                ? `نموذج بصري مولّد: ${reaction.caption}`
                : isImage
                  ? reaction.caption
                  : `${reaction.caption} — غلاف الرياكشن`
            }
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
          {!savedView && <span className="card-shade" />}
          {isVideo && Number.isFinite(reaction.duration) && reaction.duration > 0 && (
            <span className="card-duration mono" dir="ltr">
              {reaction.duration}s
            </span>
          )}
          <span className="card-play" aria-hidden="true">
            {isVideo ? <Play size={22} fill="currentColor" /> : <Expand size={22} />}
          </span>
          {!savedView && (
            <span className="card-caption">
              <b>{reaction.caption}</b>
            </span>
          )}
        </button>
        <button
          className={`save-button ${saved ? 'is-saved' : ''}`}
          aria-label={saved ? `إزالة ${reaction.caption} من المحفوظات` : `حفظ ${reaction.caption}`}
          aria-pressed={saved}
          onClick={() => app.toggleSave(reaction.code)}
        >
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="card-info">
        <Link href={`/r/${reaction.code}`}>
          {savedView ? (
            <div className="saved-card-copy">
              <b>{reaction.caption}</b>
              <span>{reaction.situation}</span>
            </div>
          ) : (
            <span>{reaction.situation}</span>
          )}
          <ArrowUpLeft size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
