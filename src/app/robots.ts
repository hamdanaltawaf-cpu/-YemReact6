import type { MetadataRoute } from 'next';
import { publicOrigin } from '@/lib/site-url';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/login', '/saved'] },
    sitemap: `${publicOrigin()}/sitemap.xml`,
  };
}
