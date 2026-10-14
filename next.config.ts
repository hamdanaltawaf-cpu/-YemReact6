import type { NextConfig } from 'next';
const config: NextConfig = {
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  // Keep metadata blocking: a missing reaction must return HTTP 404, not a streamed 200.
  htmlLimitedBots: /.*/,
  serverExternalPackages: ['better-sqlite3'],
  // Collect route data sequentially: parallel build workers can race SQLite initialization.
  experimental: { cpus: 1 },
  images: { unoptimized: true },
  async redirects() {
    // الجذر صار بوّابة الدخول (src/app/page.tsx) — لا ريدايركت ثابت هنا.
    // Legacy /about fragments still resolve through /help.
    // DECISION-5.1: البحث حالة من المكتبة (?q=) — مسار /search قديم يوجّه إليها ويحافظ على q.
    return [
      { source: '/about', destination: '/help', permanent: true },
      { source: '/search', destination: '/library', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
export default config;
