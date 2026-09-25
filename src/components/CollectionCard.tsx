import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpLeft } from 'lucide-react';
import type { Collection } from '@/lib/collections';

export function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link className="collection-card" href={`/collections/${collection.slug}`}>
      <span className="collection-cover">
        {collection.cover && (
          <Image
            src={collection.cover}
            alt=""
            fill
            sizes="(max-width: 600px) 68vw, (max-width: 1100px) 31vw, 350px"
            className="collection-cover-image"
          />
        )}
      </span>
      <span className="collection-card-copy">
        <span className="collection-card-title">{collection.title}</span>
        <span className="collection-card-meta">
          <span>
            <bdi className="mono" dir="ltr">
              {collection.count}
            </bdi>{' '}
            رياكشن
          </span>
          <ArrowUpLeft size={17} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
