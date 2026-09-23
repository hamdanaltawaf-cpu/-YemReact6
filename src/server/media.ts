import 'server-only';
import { ApiError } from './auth';
import {
  inspectMedia,
  inspectStoredMedia,
  createVideoPoster,
  MediaInspectionError,
} from '../../scripts/media-inspection.mjs';
async function translate<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof MediaInspectionError) throw new ApiError(error.status, error.message);
    throw error;
  }
}
export const verifyMediaFile = (file: string) => translate(() => inspectMedia(file));
export const verifyStoredMedia = (url: string) => translate(() => inspectStoredMedia(url));
export const makeVideoPoster = (file: string, destination: string) =>
  translate(() => createVideoPoster(file, destination));
