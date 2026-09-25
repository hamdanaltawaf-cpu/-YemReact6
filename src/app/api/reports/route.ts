import { z } from 'zod';
import { db, findReaction } from '@/server/db';
import { requireAdmin, sameOrigin, rateLimit, apiError, ApiError } from '@/server/auth';
export const runtime = 'nodejs';
const schema = z.object({
  code: z.string().regex(/^YR-[A-Z0-9-]{4,32}$/),
  reason: z.enum(['حقوق المحتوى', 'محتوى غير مناسب', 'رابط لا يعمل', 'أخرى']),
  detail: z.string().trim().max(500).default(''),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    rateLimit(req, 'report', 8);
    const raw = await req.text();
    if (raw.length > 4096) throw new ApiError(413, 'البلاغ طويل جدًا.');
    const input = schema.parse(JSON.parse(raw));
    if (!findReaction(input.code)) throw new ApiError(404, 'الرياكشن غير موجود.');
    db.prepare('INSERT INTO reports(code,reason,detail,created_at) VALUES (?,?,?,?)').run(
      input.code,
      input.reason,
      input.detail,
      new Date().toISOString(),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function GET() {
  try {
    await requireAdmin();
    return Response.json(
      {
        reports: db
          .prepare(
            'SELECT id,code,reason,detail,created_at FROM reports ORDER BY id DESC LIMIT 100',
          )
          .all(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
