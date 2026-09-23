import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { isValidVideoDuration, VIDEO_DURATION_ERROR } from './video-policy.mjs';
const run = promisify(execFile);
export const MEDIA_METADATA_VERSION = 1;
export class MediaInspectionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (message) => new MediaInspectionError(400, message);
export function sniffExtension(buffer) {
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png';
  if (buffer.subarray(0, 3).toString('hex') === 'ffd8ff') return 'jpg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return 'webp';
  if (buffer.subarray(4, 8).toString() === 'ftyp') return 'mp4';
  if (buffer.subarray(0, 4).toString('hex') === '1a45dfa3') return 'webm';
  return null;
}
function webmDocumentType(buffer) {
  const vint = (offset, identifier = false) => {
    const first = buffer[offset];
    let width = 1;
    while (width <= 8 && !(first & (0x80 >> (width - 1)))) width++;
    if (width > (identifier ? 4 : 8) || offset + width > buffer.length)
      throw bad('ملف WebM غير صالح.');
    let value = identifier ? first : first & ((0x80 >> (width - 1)) - 1);
    for (let i = 1; i < width; i++) value = value * 256 + buffer[offset + i];
    if (!Number.isSafeInteger(value) || (!identifier && value === 2 ** (7 * width) - 1))
      throw bad('ملف WebM غير صالح.');
    return { value, width };
  };
  const header = vint(4);
  let offset = 4 + header.width;
  const end = offset + header.value;
  if (header.value > 4096 || end > buffer.length) throw bad('ملف WebM غير صالح.');
  let docType;
  while (offset < end) {
    const id = vint(offset, true);
    const size = vint(offset + id.width);
    const start = offset + id.width + size.width;
    offset = start + size.value;
    if (offset > end) throw bad('ملف WebM غير صالح.');
    if (id.value === 0x4282) {
      if (docType !== undefined) throw bad('ملف WebM غير صالح.');
      docType = buffer.subarray(start, offset).toString();
    }
  }
  return docType;
}
export async function storedMediaPath(media) {
  let root, file;
  if (/^\/media\/(demo-[1-6]\.mp4|portrait-[1-6]\.webp)$/.test(media)) {
    root = path.resolve('public/media');
    file = path.join(root, path.basename(media));
  } else if (/^\/api\/media\/[a-f0-9-]+\.(mp4|webm|png|jpg|webp)$/.test(media)) {
    root = path.resolve(process.env.DATA_DIR || 'data', 'uploads');
    file = path.join(root, path.basename(media));
  } else throw bad('مسار الوسائط غير صالح.');
  try {
    if ((await lstat(file)).isSymbolicLink()) throw bad('ملف الوسائط غير صالح.');
    const actual = await realpath(file);
    if (!actual.startsWith((await realpath(root)) + path.sep)) throw bad('مسار الوسائط غير صالح.');
    return actual;
  } catch (e) {
    if (e instanceof MediaInspectionError) throw e;
    throw bad('ملف الوسائط غير موجود.');
  }
}
export async function inspectMedia(file) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !stat.size || stat.size > 15 * 1024 * 1024)
      throw bad('اختر ملفًا صالحًا بحجم لا يتجاوز 15MB.');
    const buffer = await readFile(file),
      extension = sniffExtension(buffer);
    if (!extension) throw bad('الصيغ المقبولة: JPG، PNG، WebP، MP4، WebM.');
    const common = {
      mediaVerified: true,
      mediaMetadataVersion: MEDIA_METADATA_VERSION,
      mediaSha256: createHash('sha256').update(buffer).digest('hex'),
      extension,
    };
    if (['jpg', 'png', 'webp'].includes(extension)) {
      // libvips can read APNG's first frame as PNG; reject its animation control chunk explicitly.
      if (extension === 'png') {
        for (let offset = 8; offset + 12 <= buffer.length;) {
          if (buffer.subarray(offset + 4, offset + 8).toString() === 'acTL')
            throw bad('اختر صورة ثابتة؛ الصور المتحركة غير مدعومة حاليًا.');
          offset += buffer.readUInt32BE(offset) + 12;
        }
      }
      const options = { failOn: 'warning', limitInputPixels: 40_000_000 };
      const info = await sharp(buffer, options).metadata();
      if (
        info.format !== { jpg: 'jpeg', png: 'png', webp: 'webp' }[extension] ||
        !info.width ||
        !info.height
      )
        throw bad('ملف الصورة غير صالح.');
      if ((info.pages || 1) > 1) throw bad('اختر صورة ثابتة؛ الصور المتحركة غير مدعومة حاليًا.');
      // Decode pixels, not just the header. Limit dimensions and force malformed-file failures.
      await sharp(buffer, options).rotate().resize(1, 1).png().toBuffer();
      const rotate = [5, 6, 7, 8].includes(info.orientation);
      return {
        ...common,
        type: 'image',
        mimeType: extension === 'jpg' ? 'image/jpeg' : 'image/' + extension,
        duration: null,
        width: rotate ? info.height : info.width,
        height: rotate ? info.width : info.height,
      };
    }
    // Parse the EBML header structurally. A "webm" byte sequence in a Void/CRC field is not DocType.
    if (extension === 'webm' && webmDocumentType(buffer) !== 'webm')
      throw bad('اختر فيديو بصيغة WebM صالحة.');
    const { stdout } = await run(
      process.env.FFPROBE_PATH || 'ffprobe',
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-f',
        extension === 'webm' ? 'matroska' : 'mov',
        '-show_entries',
        'format=duration:stream=codec_type,duration,width,height:stream_disposition=attached_pic',
        '-of',
        'json',
        file,
      ],
      { timeout: 15000, maxBuffer: 256 * 1024, windowsHide: true },
    );
    const data = JSON.parse(stdout),
      video = data.streams?.find(
        (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1,
      );
    if (!video || !video.width || !video.height || video.width * video.height > 40_000_000)
      throw bad('الملف لا يحتوي على مسار فيديو صالح.');
    const container = Number(data.format?.duration),
      stream = Number(video.duration);
    const duration = Number.isFinite(container) ? container : stream;
    if (
      !isValidVideoDuration(duration) ||
      (Number.isFinite(stream) && !isValidVideoDuration(stream))
    )
      throw bad(VIDEO_DURATION_ERROR);
    return {
      ...common,
      type: 'video',
      mimeType: 'video/' + extension,
      duration,
      width: video.width,
      height: video.height,
    };
  } catch (e) {
    if (e instanceof MediaInspectionError) throw e;
    if (e.code === 'ENOENT' && e.syscall?.startsWith('spawn'))
      throw new MediaInspectionError(503, 'تعذّر تشغيل خدمة فحص الوسائط. حاول لاحقًا.');
    throw bad(
      'تعذّر التحقق من الملف. اختر صورة أو فيديو صالحًا؛ مدة الفيديو من ثانيتين إلى 60 ثانية.',
    );
  }
}
export async function inspectStoredMedia(media) {
  const file = await storedMediaPath(media),
    metadata = await inspectMedia(file);
  if (path.extname(file).slice(1) !== metadata.extension)
    throw bad('امتداد الملف لا يطابق محتواه. أعد رفع الملف.');
  return metadata;
}
export async function createVideoPoster(file, destination) {
  try {
    await run(
      process.env.FFMPEG_PATH || 'ffmpeg',
      [
        '-v',
        'error',
        '-nostdin',
        '-protocol_whitelist',
        'file',
        '-threads',
        '1',
        '-i',
        file,
        '-frames:v',
        '1',
        '-an',
        '-vf',
        'scale=640:640:force_original_aspect_ratio=decrease',
        '-filter_threads',
        '1',
        '-threads',
        '1',
        '-c:v',
        'mjpeg',
        '-q:v',
        '3',
        '-f',
        'image2',
        destination,
      ],
      { timeout: 15000, maxBuffer: 256 * 1024, windowsHide: true },
    );
    const poster = await inspectMedia(destination);
    if (poster.type !== 'image') throw Error('Invalid poster');
  } catch (e) {
    if (e.code === 'ENOENT' && e.syscall?.startsWith('spawn'))
      throw new MediaInspectionError(503, 'تعذّر تشغيل خدمة معاينة الفيديو.');
    throw bad('تعذّر استخراج معاينة للفيديو. اختر ملف فيديو قابلًا للتشغيل.');
  }
}
