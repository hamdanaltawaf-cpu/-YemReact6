import { z } from 'zod';
import { db, listReactions, audit } from '@/server/db';
import { requireAdmin, sameOrigin, apiError, ApiError } from '@/server/auth';
import { CATEGORIES } from '@/lib/categories';
import {
  MIN_VIDEO_DURATION,
  MAX_VIDEO_DURATION,
  isValidVideoDuration,
  VIDEO_DURATION_ERROR,
} from '@/lib/video';
import { probeVideoDuration, reactionVideoPath } from '@/server/video';
export const runtime = 'nodejs';
export async function GET() {
  return Response.json(
    { reactions: listReactions() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
const schema = z.object({
  code: z.string().regex(/^YR-[A-Z0-9-]{4,32}$/),
  caption: z.string().trim().min(1).max(100),
  situation: z.string().trim().min(3).max(250),
  category: z.string().refine((s) => CATEGORIES.some((c) => c.id === s)),
  duration: z.number().finite().min(MIN_VIDEO_DURATION).max(MAX_VIDEO_DURATION),
  keywords: z.array(z.string().trim().min(1).max(40)).max(12),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  poster: z
    .string()
    .regex(/^\/(media\/portrait-[1-6]\.webp|api\/media\/[a-f0-9-]+\.(webp|jpg|png))$/),
  media: z.string().regex(/^\/(media\/demo-[1-6]\.mp4|api\/media\/[a-f0-9-]+\.(mp4|webm))$/),
  isDemo: z.boolean(),
  corner: z.enum(['tr', 'tl']).default('tr'),
  gradient: z
    .literal('linear-gradient(155deg,#392b24,#171211)')
    .default('linear-gradient(155deg,#392b24,#171211)'),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireAdmin();
    const input = await req.json();
    if (!isValidVideoDuration(input?.duration)) throw new ApiError(400, VIDEO_DURATION_ERROR);
    const r = schema.parse(input);
    if (r.media.startsWith('/media/demo-') && !r.isDemo)
      throw new ApiError(400, 'يجب إبقاء علامة النموذج التجريبي على الوسائط التجريبية.');
    // Do not trust the client-supplied duration or allow direct API publication to bypass upload checks.
    r.duration = await probeVideoDuration(reactionVideoPath(r.media));
    db.prepare(
      'INSERT INTO reactions VALUES (?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data',
    ).run(r.code, JSON.stringify(r));
    audit(u.id, 'upsert', r.code);
    return Response.json({ reaction: r });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireAdmin();
    const { code } = z.object({ code: z.string().max(40) }).parse(await req.json());
    db.prepare('DELETE FROM reactions WHERE code=?').run(code);
    audit(u.id, 'delete', code);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
