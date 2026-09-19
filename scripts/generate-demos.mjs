/** Recreate the silent prototype zoom clips from the committed WebP portraits. Requires FFmpeg. */
import { execFileSync } from 'node:child_process';
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
for (const [index, duration] of [2, 3, 4, 3, 5, 2].entries()) {
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-loop',
      '1',
      '-i',
      `public/media/portrait-${index + 1}.webp`,
      '-vf',
      `scale=800:800,zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * 24}:s=480x600:fps=24`,
      '-t',
      String(duration),
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-threads',
      '2',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      `public/media/demo-${index + 1}.mp4`,
    ],
    { stdio: 'inherit' },
  );
}
