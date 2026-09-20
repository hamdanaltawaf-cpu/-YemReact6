import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './auth';
import { isValidVideoDuration, VIDEO_DURATION_ERROR } from '@/lib/video';
const run = promisify(execFile);

/** Probe local file metadata before storage/publication. No shell or remote media URLs. */
export async function probeVideoDuration(filePath: string): Promise<number> {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0 || info.size > 15 * 1024 * 1024)
      throw new ApiError(400, 'اختر ملف فيديو صالحًا بحجم لا يتجاوز 15MB.');
    const { stdout } = await run(
      process.env.FFPROBE_PATH || 'ffprobe',
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-f',
        filePath.toLowerCase().endsWith('.webm') ? 'matroska' : 'mov',
        '-show_entries',
        'format=duration:stream=codec_type,duration:stream_disposition=attached_pic',
        '-of',
        'json',
        filePath,
      ],
      { timeout: 15000, maxBuffer: 256 * 1024, windowsHide: true },
    );
    const metadata = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: {
        codec_type?: string;
        duration?: string;
        disposition?: { attached_pic?: number };
      }[];
    };
    const videos =
      metadata.streams?.filter(
        (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1,
      ) || [];
    if (!videos.length) throw new ApiError(400, 'الملف لا يحتوي على مسار فيديو صالح.');
    const containerDuration = Number(metadata.format?.duration);
    const videoDuration = Number(videos[0].duration);
    // WebM commonly reports duration on the container rather than individual streams.
    const duration = Number.isFinite(containerDuration) ? containerDuration : videoDuration;
    if (
      !isValidVideoDuration(duration) ||
      (Number.isFinite(videoDuration) && !isValidVideoDuration(videoDuration))
    )
      throw new ApiError(400, VIDEO_DURATION_ERROR);
    return duration;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (
      (error as NodeJS.ErrnoException).code === 'ENOENT' &&
      (error as NodeJS.ErrnoException).syscall?.startsWith('spawn')
    ) {
      throw new ApiError(503, 'تعذّر تشغيل خدمة فحص الفيديو. حاول لاحقًا.');
    }
    throw new ApiError(
      400,
      'تعذّر التحقق من ملف الفيديو. اختر ملف MP4 أو WebM صالحًا بمدة من ثانيتين إلى 60 ثانية.',
    );
  }
}

export function reactionVideoPath(media: string): string {
  if (/^\/media\/demo-[1-6]\.mp4$/.test(media)) return path.resolve('public', media.slice(1));
  if (/^\/api\/media\/[a-f0-9-]+\.(mp4|webm)$/.test(media))
    return path.resolve(process.env.DATA_DIR || 'data', 'uploads', path.basename(media));
  throw new ApiError(400, 'مسار الفيديو غير صالح.');
}
