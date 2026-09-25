'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
              ? 'احفظ ما يعجبك لتعود إليه من أي جهاز.'
              : 'احفظ ما يعجبك لتعود إليه من هذا المتصفح.'}
          </p>
        </div>
        {authReady && (
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
      ) : (
        items.length > 0 && (
          <div className="saved-gallery">
            <ReactionMasonry key={user?.id || 'guest'} items={items} savedView />
          </div>
        )
      )}
    </section>
  );
}
