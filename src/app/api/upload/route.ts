import { mkdir, writeFile, mkdtemp, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAdmin, sameOrigin, rateLimit, ApiError, apiError } from '@/server/auth';
import { verifyMediaFile, makeVideoPoster } from '@/server/media';
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
      throw new ApiError(400, 'اختر ملفًا صالحًا بحجم لا يتجاوز 15MB.');
    const root = path.resolve(process.env.DATA_DIR || 'data');
    const dir = path.join(root, 'uploads');
    await mkdir(dir, { recursive: true });
    const temporary = await mkdtemp(path.join(root, '.media-check-'));
    try {
      // Names and browser MIME are hints only. Validate bytes before publishing any URL.
      const candidate = path.join(temporary, 'upload');
      await writeFile(candidate, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
      const metadata = await verifyMediaFile(candidate);
      const name = randomUUID() + '.' + metadata.extension;
      const url = '/api/media/' + name;
      let poster = url;
      if (metadata.type === 'video') {
        const posterName = randomUUID() + '.jpg';
        const frame = path.join(temporary, 'frame.jpg');
        await makeVideoPoster(candidate, frame);
        await rename(frame, path.join(dir, posterName));
        poster = '/api/media/' + posterName;
      }
      await rename(candidate, path.join(dir, name));
      return Response.json({ url, poster, ...metadata });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  } catch (e) {
    return apiError(e);
  }
}
