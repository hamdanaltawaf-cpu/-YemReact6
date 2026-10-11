/**
 * The single source of the public origin used by metadata, sitemap and robots.
 *
 * Operators paste the value by hand, so a trailing slash must not leak into the
 * URLs we publish: `${origin}/sitemap.xml` has to stay a real URL, and the
 * post-deploy verifier compares these URLs against the live origin exactly.
 */
export function publicOrigin(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL) {
  const raw = (value ?? '').trim() || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}
