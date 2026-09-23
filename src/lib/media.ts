/** Rendering uses server-verified metadata only. URL extensions are download hints, not type proof. */
export function verifiedMediaType(media: {
  type?: string;
  mediaVerified?: boolean;
  mediaMetadataVersion?: number;
  mimeType?: string | null;
}): 'image' | 'video' | 'unknown' {
  if (media.mediaVerified !== true || media.mediaMetadataVersion !== 1) return 'unknown';
  if (
    media.type === 'image' &&
    ['image/jpeg', 'image/png', 'image/webp'].includes(media.mimeType || '')
  )
    return 'image';
  if (media.type === 'video' && ['video/mp4', 'video/webm'].includes(media.mimeType || ''))
    return 'video';
  return 'unknown';
}
export const mediaActionLabel = (media: Parameters<typeof verifiedMediaType>[0]) => {
  const kind = verifiedMediaType(media);
  return kind === 'video' ? 'تشغيل الفيديو' : kind === 'image' ? 'عرض الصورة' : 'عرض تفاصيل الملف';
};
export function videoSeconds(duration: number | null | undefined) {
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    ? `${Number(duration.toFixed(1))}s`
    : null;
}
/** Media kind comes from the pathname, never from query-string text. */
export const mediaPathname = (src: string) => src.split(/[?#]/, 1)[0];
export const isVideoMedia = (src: string) => /\.(mp4|webm)$/i.test(mediaPathname(src));
export const isImageMedia = (src: string) =>
  /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(mediaPathname(src));
export function mediaFileExtension(src: string, mime = '') {
  const types: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
  };
  const type = mime.split(';', 1)[0].trim().toLowerCase();
  return (
    types[type] ||
    mediaPathname(src)
      .match(/\.(mp4|webm|png|jpe?g|webp|gif|avif|svg)$/i)?.[0]
      .toLowerCase() ||
    '.bin'
  );
}
