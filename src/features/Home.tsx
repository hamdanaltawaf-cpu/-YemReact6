'use client';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { ReactionCard } from '@/components/ReactionCard';
import { ReactionMasonry } from '@/components/ReactionMasonry';
import { CollectionCard } from '@/components/CollectionCard';
import type { Collection } from '@/lib/collections';

export default function Home({ collections }: { collections: Collection[] }) {
  const { reactions } = useApp();
  const featured = reactions[0];
  return (
    <>
      <section className="container home-intro">
        <div className="home-intro-copy">
          <span className="eyebrow">
            <span className="live-dot" /> مكتبة رياكشنات يمنية
          </span>
          <h1>ردّك، في لقطة.</h1>
          <p>فيديوهات وصور قصيرة، جاهزة للردّ الذي تريده.</p>
          <div className="home-intro-actions">
            <Link className="btn btn-dark" href="/library">
              استكشف المكتبة <ArrowLeft size={17} aria-hidden="true" />
            </Link>
            <Link className="text-button" href="/collections">
              تصفّح المجموعات <ArrowUpLeft size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        {featured && (
          <div className="home-featured">
            <ReactionCard reaction={featured} />
          </div>
        )}
      </section>
      {collections.length > 0 && (
        <section className="container home-collections" aria-labelledby="home-collections-title">
          <div className="home-section-heading">
            <div>
              <span className="eyebrow">اختيارات منتقاة</span>
              <h2 id="home-collections-title">المجموعات</h2>
            </div>
            <Link className="text-button" href="/collections">
              كل المجموعات <ArrowLeft size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="collection-rail">
            {collections.slice(0, 5).map((collection) => (
              <CollectionCard key={collection.slug} collection={collection} />
            ))}
          </div>
        </section>
      )}
      {reactions.length > 0 && (
        <section className="container home-library" aria-labelledby="home-library-title">
          <div className="home-section-heading">
            <div>
              <span className="eyebrow">اكتشف المزيد</span>
              <h2 id="home-library-title">من المكتبة</h2>
            </div>
            <Link className="text-button" href="/library">
              تصفّح المكتبة <ArrowLeft size={16} aria-hidden="true" />
            </Link>
          </div>
          <ReactionMasonry items={reactions.slice(0, 8)} />
        </section>
      )}
    </>
  );
}
