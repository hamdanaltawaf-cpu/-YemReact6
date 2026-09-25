'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { Reaction } from '@/lib/reactions';
import type { Collection } from '@/lib/collections';
import { detailRecommendations } from '@/lib/collections';
import { verifiedMediaType } from '@/lib/media';
import { useApp } from '@/components/AppProvider';
import { ClipPlayer, ReactionActions } from '@/components/Clip';
import { ReactionMasonry } from '@/components/ReactionMasonry';
import { ReactionMenu } from '@/components/ReactionMenu';

export default function Detail({
  reaction,
  collections,
}: {
  reaction: Reaction;
  collections: Collection[];
}) {
  const { reactions } = useApp();
  const router = useRouter();
  const { related, more } = detailRecommendations(reaction, reactions, collections);
  function goBack() {
    const referrer = document.referrer;
    const sameSite = referrer && new URL(referrer).origin === window.location.origin;
    if (window.history.state?.idx > 0 || sameSite) router.back();
    else router.push('/library');
  }
  return (
    <article className="container detail-page">
      <div className="detail-main">
        <div className="detail-media-stage">
          <button className="detail-back" onClick={goBack} aria-label="رجوع إلى الصفحة السابقة">
            <ArrowRight size={18} aria-hidden="true" /> رجوع
          </button>
          <ClipPlayer reaction={reaction} />
        </div>
        <div className="detail-content">
          <div className="detail-titlebar">
            <h1>{reaction.caption}</h1>
            <div className="detail-controls">
              <ReactionActions reaction={reaction} />
              <ReactionMenu reaction={reaction} detail />
            </div>
          </div>
          {reaction.characterName && (
            <div className="detail-meta">
              <span className="character-chip" title={reaction.characterName}>
                {reaction.characterName}
              </span>
              <span aria-hidden="true" className="detail-meta-separator">
                ·
              </span>
              <span className="detail-meta-description">{reaction.caption}</span>
            </div>
          )}
          {reaction.situation?.trim() && (
            <details className="detail-secondary">
              <summary>
                الوصف الثنائي <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <p>{reaction.situation}</p>
            </details>
          )}
          {collections.length > 0 && (
            <div className="detail-collections" aria-label="المجموعات">
              <h2>المجموعات</h2>
              <div>
                {collections.map((collection) => (
                  <Link href={`/collections/${collection.slug}`} key={collection.slug}>
                    {collection.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {reaction.isDemo && (
            <p className="detail-demo-note">
              {verifiedMediaType(reaction) === 'video'
                ? 'نموذج تجريبي متحرك من صورة مولّدة؛ ليس مشهدًا أو أداءً لشخص حقيقي.'
                : 'نموذج تجريبي من صورة مولّدة؛ ليس تصويرًا لشخص حقيقي.'}
            </p>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="detail-recommendations" aria-labelledby="related-title">
          <div className="home-section-heading">
            <h2 id="related-title">رياكشنات ذات صلة</h2>
          </div>
          <ReactionMasonry items={related} />
        </section>
      )}
      {more.length > 0 && (
        <section className="detail-recommendations" aria-labelledby="more-title">
          <div className="home-section-heading">
            <h2 id="more-title">المزيد من المكتبة</h2>
            <Link className="text-button" href="/library">
              المكتبة <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ReactionMasonry items={more} />
        </section>
      )}
    </article>
  );
}
