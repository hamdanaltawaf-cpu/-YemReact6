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
