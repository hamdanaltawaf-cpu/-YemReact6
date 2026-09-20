'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { ReactionMasonry } from '@/components/ReactionMasonry';
import { savedReactions } from '@/lib/saved';

export default function Saved() {
  const { reactions, saved, user, authReady } = useApp();
  const items = useMemo(() => savedReactions(reactions, saved), [reactions, saved]);
  return (
    <section className="container saved-page" aria-labelledby="saved-title">
      <div className="saved-heading">
        <div>
          <h1 id="saved-title">المحفوظات</h1>
          <p>
            {user
              ? 'صور وفيديوهات اخترتها، لتعود إليها متى شئت.'
              : 'صور وفيديوهات احتفظت بها في هذا المتصفح.'}
          </p>
        </div>
        {authReady && items.length > 0 && (
          <Link className="saved-browse" href="/library">
            تصفّح المكتبة <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        )}
      </div>
      {!authReady ? (
        <div className="saved-loading" role="status" aria-label="جارٍ تحميل المحفوظات">
          <span className="sr-only">جارٍ تحميل المحفوظات…</span>
          {[0, 1, 2, 3].map((key) => (
            <div className="saved-placeholder" key={key} aria-hidden="true" />
          ))}
        </div>
      ) : items.length ? (
        <div className="saved-gallery">
          <ReactionMasonry key={user?.id || 'guest'} items={items} savedView />
        </div>
      ) : (
        <div className="saved-empty">
          <div className="saved-empty-icon" aria-hidden="true">
            <Bookmark size={30} strokeWidth={1.5} />
          </div>
          <h2>احتفظ بما يعجبك.</h2>
          <p>احفظ صورة أو فيديو من المكتبة، وستجده هنا.</p>
          <Link className="btn btn-dark" href="/library">
            تصفّح المكتبة <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
