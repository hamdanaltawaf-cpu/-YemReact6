import type { MetadataRoute } from 'next';
import { listReactions } from '@/server/db';
export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return [
    { url: base, priority: 1 },
    { url: base + '/library', priority: 0.9 },
    { url: base + '/about', priority: 0.5 },
    ...listReactions().map((r) => ({
      url: base + '/r/' + r.code,
      lastModified: new Date(r.publishedAt),
      priority: 0.7,
    })),
  ];
}
