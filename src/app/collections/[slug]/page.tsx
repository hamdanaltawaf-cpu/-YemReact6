import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { collectionBySlug } from '@/server/collections';
import { listReactions } from '@/server/db';
import { collectionMembers } from '@/lib/collections';
import { ReactionMasonry } from '@/components/ReactionMasonry';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const collection = collectionBySlug(slug);
  if (!collection) notFound();
  return {
    title: collection.title,
    description: collection.description || `مجموعة ${collection.title} من مكتبة يمن رياكت.`,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: collection.cover ? { images: [collection.cover] } : undefined,
  };
}
export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = collectionBySlug(slug);
  if (!collection) notFound();
  const members = collectionMembers(collection, listReactions());
  return (
    <section className="container collection-page" aria-labelledby="collection-title">
      <Link className="collection-back" href="/collections">
        <ArrowRight size={17} aria-hidden="true" /> المجموعات
      </Link>
      <header className="collections-intro">
        <h1 id="collection-title">{collection.title}</h1>
        {collection.description && <p>{collection.description}</p>}
      </header>
      {members.length > 0 && <ReactionMasonry items={members} />}
    </section>
  );
}
