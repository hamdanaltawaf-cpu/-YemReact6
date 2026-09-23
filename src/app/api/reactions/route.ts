import { z } from 'zod';
import { db, listReactions, audit } from '@/server/db';
import { requireAdmin, sameOrigin, apiError, ApiError } from '@/server/auth';
import { CATEGORIES } from '@/lib/categories';
import { isValidVideoDuration, VIDEO_DURATION_ERROR } from '@/lib/video';
import { verifyStoredMedia } from '@/server/media';
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
  duration: z.number().finite().nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(40)).max(12),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  poster: z
    .string()
    .regex(/^\/(media\/portrait-[1-6]\.webp|api\/media\/[a-f0-9-]+\.(webp|jpg|png))$/)
    .optional(),
  media: z
    .string()
    .regex(
      /^\/(media\/(demo-[1-6]\.mp4|portrait-[1-6]\.webp)|api\/media\/[a-f0-9-]+\.(mp4|webm|png|jpg|webp))$/,
    ),
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
    const parsed = schema.parse(input);
    if (parsed.media.startsWith('/media/') && !parsed.isDemo)
      throw new ApiError(400, 'يجب إبقاء علامة النموذج التجريبي على الوسائط التجريبية.');
    // Re-probe the actual file; never accept client-supplied type, MIME or verification flags.
    const metadata = await verifyStoredMedia(parsed.media);
    if (
      metadata.type === 'video' &&
      parsed.duration != null &&
      !isValidVideoDuration(parsed.duration)
    )
      throw new ApiError(400, VIDEO_DURATION_ERROR);
    let poster = parsed.media;
    if (metadata.type === 'video') {
      if (!parsed.poster) throw new ApiError(400, 'اختر صورة معاينة صالحة للفيديو.');
      const cover = await verifyStoredMedia(parsed.poster);
      if (cover.type !== 'image') throw new ApiError(400, 'غلاف الفيديو يجب أن يكون صورة.');
      poster = parsed.poster;
    }
    const r = { ...parsed, ...metadata, poster };
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
