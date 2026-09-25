import { CollectionCard } from '@/components/CollectionCard';
import { listCollections } from '@/server/collections';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'المجموعات',
  description: 'مجموعات منتقاة من رياكشنات يمن رياكت.',
  alternates: { canonical: '/collections' },
};
export default function CollectionsPage() {
  const collections = listCollections();
  return (
    <section className="container collections-page" aria-labelledby="collections-title">
      <header className="collections-intro">
        <span className="eyebrow">اختيارات من المكتبة</span>
        <h1 id="collections-title">المجموعات</h1>
        <p>لقطات متقاربة، في مكان واحد.</p>
      </header>
      {collections.length > 0 && (
        <div className="collections-grid">
          {collections.map((collection) => (
            <CollectionCard key={collection.slug} collection={collection} />
          ))}
        </div>
      )}
    </section>
  );
}
