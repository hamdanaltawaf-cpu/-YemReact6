import { NextResponse, type NextRequest } from 'next/server';
import { decideGate, GUEST_COOKIE, SESSION_COOKIE } from '@/lib/gate';

export function middleware(request: NextRequest) {
  const decision = decideGate({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    method: request.method,
    accept: request.headers.get('accept') ?? '',
    userAgent: request.headers.get('user-agent') ?? '',
    hasSession: Boolean(request.cookies.get(SESSION_COOKIE)?.value),
    hasGuest: request.cookies.get(GUEST_COOKIE)?.value === '1',
    // ترويسة rsc تعالجها طبقة Next قبل middleware؛ عميل الموجّه يرسل أيضًا ?_rsc= في العنوان
    isRsc: request.headers.has('rsc') || request.nextUrl.searchParams.has('_rsc'),
    isPrefetch:
      request.headers.get('next-router-prefetch') === '1' ||
      request.headers.get('purpose') === 'prefetch' ||
      request.headers.get('sec-purpose') === 'prefetch',
  });
  if (!decision.gate) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('next', decision.next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|api/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|og.png).*)',
  ],
};
