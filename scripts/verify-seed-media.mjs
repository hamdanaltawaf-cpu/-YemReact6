import { writeFile } from 'node:fs/promises';
import { inspectStoredMedia } from './media-inspection.mjs';
import { loadAppEnvironment } from './load-env.mjs';
loadAppEnvironment(process.argv.includes('--dev'));
const manifest = {};
for (let i = 1; i <= 6; i++) {
  for (const media of [`/media/demo-${i}.mp4`, `/media/portrait-${i}.webp`])
    manifest[media] = await inspectStoredMedia(media);
}
await writeFile('src/lib/seed-media.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Bundled media verified from file bytes, image decoding and video streams.');
