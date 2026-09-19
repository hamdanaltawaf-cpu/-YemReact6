'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, Play, ArrowUpLeft } from 'lucide-react';
import { CAT_BY_ID } from '@/lib/categories';
import type { Reaction } from '@/lib/reactions';
import { useApp } from './AppProvider';
export function ReactionCard({ reaction, index = 0 }: { reaction: Reaction; index?: number }) {
  const app = useApp(),
    saved = app.saved.includes(reaction.code),
    cat = CAT_BY_ID[reaction.category];
  return (
    <article className="reaction-card">
      <div className="card-visual">
        <button
          className="card-preview"
          onClick={() => app.setPreview(reaction.code)}
          title={`معاينة الرياكشن: ${reaction.caption}`}
        >
          <span className="sr-only">معاينة الرياكشن: </span>
          <Image
            src={reaction.poster}
            alt={
              reaction.isDemo
                ? `نموذج بصري مولّد: ${reaction.caption}`
                : `${reaction.caption} — غلاف الرياكشن`
            }
            fill
            sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 290px"
            loading="lazy"
            className="card-image"
          />
          <span className="card-shade" />
          <span className="card-code mono">{reaction.code}</span>
          <span className="card-duration mono">{reaction.duration}s</span>
          <span className="card-play">
            <Play size={22} fill="currentColor" />
          </span>
          <span className="card-caption">
            <span className="card-tag">
              <i style={{ background: cat.color }} />
              {cat.name}
            </span>
            <b>{reaction.caption}</b>
          </span>
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
          <span>{reaction.situation}</span>
          <ArrowUpLeft size={15} />
        </Link>
      </div>
    </article>
  );
}
