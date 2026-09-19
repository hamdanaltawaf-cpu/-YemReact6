import { z } from 'zod';
import { db, findReaction } from '@/server/db';
import { sameOrigin, rateLimit, apiError, ApiError } from '@/server/auth';
/** Aggregate first-party events only: no IP, cookies, or user IDs are stored. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    rateLimit(req, 'events', 120);
    const { kind, code } = z
      .object({ kind: z.enum(['play', 'download', 'share']), code: z.string().max(40) })
      .parse(await req.json());
    if (!findReaction(code)) throw new ApiError(404, 'الرياكشن غير موجود.');
    db.prepare('INSERT INTO events(kind,code,created_at) VALUES (?,?,?)').run(
      kind,
      code,
      new Date().toISOString(),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
