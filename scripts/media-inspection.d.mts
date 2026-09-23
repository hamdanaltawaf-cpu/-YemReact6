export type VerifiedMedia = {
  type: 'image' | 'video';
  mimeType: string;
  duration: number | null;
  width: number;
  height: number;
  extension: string;
  mediaVerified: true;
  mediaMetadataVersion: number;
  mediaSha256: string;
};
export const MEDIA_METADATA_VERSION: number;
export class MediaInspectionError extends Error {
  status: number;
  constructor(status: number, message: string);
}
export function sniffExtension(buffer: Buffer): string | null;
export function inspectMedia(file: string): Promise<VerifiedMedia>;
export function inspectStoredMedia(media: string): Promise<VerifiedMedia>;
export function storedMediaPath(media: string): Promise<string>;
export function createVideoPoster(file: string, destination: string): Promise<void>;
