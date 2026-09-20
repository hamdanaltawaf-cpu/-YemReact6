import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { isSameOriginRequest } from '@/lib/request-origin';
export type User = { id: string; name: string; email: string; role: 'member' | 'admin' };
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get('yr_session')?.value;
  if (!token) return null;
  return (
    (db
      .prepare(
        'SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?',
      )
      .get(digest(token), Date.now()) as User) || null
  );
}
export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new ApiError(401, 'سجّل دخولك أولًا.');
  return u;
}
export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== 'admin') throw new ApiError(403, 'هذه العملية متاحة لمالك المكتبة فقط.');
  return u;
}
export async function createSession(id: string) {
  db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token), id, Date.now() + 7 * 864e5);
  (await cookies()).set('yr_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:
      process.env.NODE_ENV === 'production' ||
      process.env.OAUTH_SITE_URL?.startsWith('https:') === true,
    path: '/',
    maxAge: 7 * 86400,
  });
}
/** Same-origin mutation guard. Forwarded host must be supplied by a trusted proxy. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (
    !isSameOriginRequest(
      origin,
      host,
      process.env.OAUTH_SITE_URL,
      process.env.OAUTH_PROXY_HOST,
      req.headers.get('sec-fetch-site'),
    )
  )
    throw new ApiError(403, 'مصدر الطلب غير مسموح.');
}
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(req: Request, group: string, limit = 30) {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.until < now) buckets.delete(key);
  const key = group + ':' + (req.headers.get('x-forwarded-for')?.split(',')[0] || 'local');
  const b = buckets.get(key) || { count: 0, until: now + 15 * 60e3 };
  b.count++;
  buckets.set(key, b);
  if (b.count > limit) throw new ApiError(429, 'طلبات كثيرة. جرّب بعد قليل.');
}
export function apiError(e: unknown) {
  if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof SyntaxError)
    return Response.json({ error: 'صيغة الطلب غير صالحة.' }, { status: 400 });
  if (e instanceof Error && e.name === 'ZodError')
    return Response.json({ error: 'راجع الحقول المطلوبة وصيغة البيانات.' }, { status: 400 });
  console.error('[YemReact API]', e instanceof Error ? e.message : 'Unknown error');
  return Response.json({ error: 'تعذّر تنفيذ الطلب. حاول مجددًا.' }, { status: 500 });
}
