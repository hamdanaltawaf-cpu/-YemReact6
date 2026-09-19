import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
/** Range support enables seeking in locally uploaded videos. */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9-]+\.(mp4|webm|png|jpg|webp)$/.test(name))
    return new Response(null, { status: 404 });
  try {
    const file = path.resolve(process.env.DATA_DIR || 'data', 'uploads', name);
    const info = await stat(file);
    const buffer = await readFile(file);
    const ext = name.split('.').pop()!;
    const mime: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      png: 'image/png',
      jpg: 'image/jpeg',
      webp: 'image/webp',
    };
    const headers: Record<string, string> = {
      'Content-Type': mime[ext],
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    };
    const range = req.headers.get('range');
    if (range) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!m) return new Response(null, { status: 416 });
      const start = Number(m[1]),
        end = m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size)
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${info.size}` },
        });
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      headers['Content-Length'] = String(end - start + 1);
      return new Response(new Uint8Array(buffer.subarray(start, end + 1)), {
        status: 206,
        headers,
      });
    }
    headers['Content-Length'] = String(info.size);
    return new Response(new Uint8Array(buffer), { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}
