import { z } from 'zod';
import { audit, db, findReaction, findReactionIncludingHidden } from '@/server/db';
import { requireAdmin, sameOrigin, rateLimit, apiError, ApiError } from '@/server/auth';
export const runtime = 'nodejs';

const reportSchema = z.object({
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
    const input = reportSchema.parse(JSON.parse(raw));
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

const statuses = ['all', 'open', 'reviewing', 'resolved'] as const;
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const requested = new URL(req.url).searchParams.get('status') || 'all';
    const status = z.enum(statuses).parse(requested);
    const rows = db
      .prepare(
        `SELECT r.id,r.code,r.reason,r.detail,r.created_at,r.status,r.resolution,
                r.review_note,r.reviewed_at,r.reviewed_by,u.name AS reviewed_by_name,
                (h.code IS NOT NULL) AS hidden
         FROM reports r LEFT JOIN hidden_reactions h ON h.code=r.code
         LEFT JOIN users u ON u.id=r.reviewed_by
         ${status === 'all' ? '' : 'WHERE r.status=?'}
         ORDER BY r.id DESC LIMIT 100`,
      )
      .all(...(status === 'all' ? [] : [status])) as Array<{
      id: number;
      code: string;
      reason: string;
      detail: string;
      created_at: string;
      status: 'open' | 'reviewing' | 'resolved';
      resolution: string;
      review_note: string;
      reviewed_at: string | null;
      reviewed_by: string | null;
      reviewed_by_name: string | null;
      hidden: number;
    }>;
    return Response.json(
      {
        reports: rows.map((report) => ({
          ...report,
          caption: findReactionIncludingHidden(report.code)?.caption || null,
          hidden: Boolean(report.hidden),
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}

const mutationSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(['review', 'keep', 'hide', 'restore', 'delete']),
  note: z.string().trim().max(500).default(''),
});

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const admin = await requireAdmin();
    const raw = await req.text();
    if (raw.length > 4096) throw new ApiError(413, 'الطلب طويل جدًا.');
    const { id, action, note } = mutationSchema.parse(JSON.parse(raw));
    const now = new Date().toISOString();
    db.transaction(() => {
      const report = db.prepare('SELECT id,code FROM reports WHERE id=?').get(id) as
        { id: number; code: string } | undefined;
      if (!report) throw new ApiError(404, 'البلاغ غير موجود.');
      if (action === 'hide' && !findReactionIncludingHidden(report.code))
        throw new ApiError(404, 'الرياكشن غير موجود ولا يمكن إخفاؤه.');
      if (action === 'restore' && !findReactionIncludingHidden(report.code))
        throw new ApiError(404, 'الرياكشن غير موجود ولا يمكن استعادته.');
      if (action === 'hide')
        db.prepare(
          'INSERT INTO hidden_reactions(code,hidden_by,hidden_at) VALUES (?,?,?) ON CONFLICT(code) DO UPDATE SET hidden_by=excluded.hidden_by,hidden_at=excluded.hidden_at',
        ).run(report.code, admin.id, now);
      if (action === 'restore')
        db.prepare('DELETE FROM hidden_reactions WHERE code=?').run(report.code);
      if (action === 'delete') db.prepare('DELETE FROM reactions WHERE code=?').run(report.code);

      const status = action === 'review' ? 'reviewing' : 'resolved';
      db.prepare(
        'UPDATE reports SET status=?,resolution=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=?',
      ).run(status, action === 'review' ? '' : action, admin.id, now, note, id);
      audit(admin.id, `report-${action}`, report.code);
    })();
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
