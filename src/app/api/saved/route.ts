import { z } from 'zod';
import { db, findReaction } from '@/server/db';
import { requireUser, sameOrigin, apiError, ApiError } from '@/server/auth';
export async function GET() {
  try {
    const u = await requireUser();
    return Response.json(
      {
        saved: (
          db.prepare('SELECT code FROM saved WHERE user_id=?').all(u.id) as { code: string }[]
        ).map((x) => x.code),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    const { code, saved } = z
      .object({ code: z.string().max(40), saved: z.boolean() })
      .parse(await req.json());
    if (!findReaction(code)) throw new ApiError(404, 'الرياكشن غير موجود.');
    if (saved) db.prepare('INSERT OR IGNORE INTO saved VALUES (?,?)').run(u.id, code);
    else db.prepare('DELETE FROM saved WHERE user_id=? AND code=?').run(u.id, code);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
