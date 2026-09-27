import type { MetadataRoute } from 'next';
import { listReactions } from '@/server/db';
import { listCollections } from '@/server/collections';
export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return [
    { url: base + '/library', priority: 1 },
    { url: base + '/collections', priority: 0.7 },
    ...listCollections().map((collection) => ({
      url: base + '/collections/' + collection.slug,
      priority: 0.6,
    })),
    { url: base + '/help', priority: 0.4 },
    { url: base + '/privacy', priority: 0.3 },
    ...listReactions().map((r) => ({
      url: base + '/r/' + r.code,
      lastModified: new Date(r.publishedAt),
      priority: 0.7,
    })),
  ];
}
