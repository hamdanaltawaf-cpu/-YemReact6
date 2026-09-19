import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAdmin, sameOrigin, rateLimit, ApiError, apiError } from '@/server/auth';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireAdmin();
    rateLimit(req, 'upload', 25);
    if (Number(req.headers.get('content-length') || 0) > 16 * 1024 * 1024)
      throw new ApiError(413, 'الحد الأقصى للملف 15MB.');
    const file = (await req.formData()).get('file');
    if (!(file instanceof File) || file.size > 15 * 1024 * 1024 || !file.size)
      throw new ApiError(400, 'اختر ملفًا صالحًا بحجم أقل من 15MB.');
    const buffer = Buffer.from(await file.arrayBuffer());
    let ext = '';
    if (buffer.subarray(4, 8).toString() === 'ftyp') ext = 'mp4';
    else if (buffer.subarray(0, 4).toString('hex') === '1a45dfa3') ext = 'webm';
    else if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') ext = 'png';
    else if (buffer.subarray(0, 3).toString('hex') === 'ffd8ff') ext = 'jpg';
    else if (
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP'
    )
      ext = 'webp';
    if (!ext) throw new ApiError(400, 'الصيغ المقبولة: MP4، WebM، JPG، PNG، WebP.');
    const dir = path.resolve(process.env.DATA_DIR || 'data', 'uploads');
    await mkdir(dir, { recursive: true });
    const name = randomUUID() + '.' + ext;
    await writeFile(path.join(dir, name), buffer, { flag: 'wx' });
    return Response.json({
      url: '/api/media/' + name,
      type: ext === 'mp4' || ext === 'webm' ? 'video' : 'image',
    });
  } catch (e) {
    return apiError(e);
  }
}
