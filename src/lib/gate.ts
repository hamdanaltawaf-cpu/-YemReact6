export const SESSION_COOKIE = 'yr_session';
export const GUEST_COOKIE = 'yr_guest';
const OPEN_PATHS = new Set(['/login', '/help', '/privacy', '/offline']);
const OPEN_PREFIXES = ['/api/', '/_next/', '/icons/'];
const ASSET_FILE = /\.[a-z0-9]{2,12}$/i; // تشمل .webmanifest
const CRAWLER =
  /(bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|pinterest|preview|lighthouse|headless|monitor|probe|uptime|pingdom|curl|wget|python-requests|axios)/i;

export function safeNext(raw: string | null | undefined, fallback = '/library'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw === '/' || raw === '/login' || raw.startsWith('/login?')) return fallback;
  if (raw.includes('\\') || raw.includes('\n') || raw.includes('\r')) return fallback;
  return raw;
}

export function decideGate(input: {
  pathname: string;
  search?: string;
  method?: string;
  accept?: string;
  userAgent?: string;
  hasSession?: boolean;
  hasGuest?: boolean;
  isRsc?: boolean;
  isPrefetch?: boolean;
}): { gate: false } | { gate: true; next: string } {
  const {
    pathname,
    search = '',
    method = 'GET',
    accept = '',
    userAgent = '',
    hasSession = false,
    hasGuest = false,
    isRsc = false,
    isPrefetch = false,
  } = input;
  if (method !== 'GET' && method !== 'HEAD') return { gate: false };
  if (pathname === '/') return { gate: false }; // الجذر صفحته تحكم
  if (OPEN_PATHS.has(pathname)) return { gate: false };
  if (OPEN_PREFIXES.some((p) => pathname.startsWith(p))) return { gate: false };
  if (ASSET_FILE.test(pathname)) return { gate: false };
  if (hasSession || hasGuest) return { gate: false }; // مسجَّل، أو اختار الزيارة
  if (CRAWLER.test(userAgent)) return { gate: false }; // فهرسة ومعاينات سليمة
  if (isPrefetch) return { gate: false };
  const wantsHtml = accept.includes('text/html');
  if (!wantsHtml && !isRsc) return { gate: false };
  return { gate: true, next: `${pathname}${search}` };
}
