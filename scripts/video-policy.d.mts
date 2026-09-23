export const MIN_VIDEO_DURATION: 2;
export const MAX_VIDEO_DURATION: 60;
export const VIDEO_DURATION_ERROR: string;
export function isValidVideoDuration(value: unknown): value is number;
