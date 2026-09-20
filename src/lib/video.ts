/** Inclusive video-duration policy shared by uploads, publishing and discovery. */
export const MIN_VIDEO_DURATION = 2;
export const MAX_VIDEO_DURATION = 60;
export const VIDEO_DURATION_ERROR = 'مدة الفيديو المسموح بها من ثانيتين إلى 60 ثانية.';
export function isValidVideoDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_VIDEO_DURATION &&
    value <= MAX_VIDEO_DURATION
  );
}
