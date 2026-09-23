/** Best-effort duration preflight. The server still verifies every byte/stream before acceptance. */
export async function browserVideoDuration(file: File): Promise<number | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const mp4 = String.fromCharCode(...head.slice(4, 8)) === 'ftyp';
  const webm = [0x1a, 0x45, 0xdf, 0xa3].every((byte, i) => head[i] === byte);
  if (!mp4 && !webm) return null;
  // A misleading browser MIME must not prevent checking an otherwise valid video.
  const url = URL.createObjectURL(new Blob([file], { type: mp4 ? 'video/mp4' : 'video/webm' }));
  try {
    return await new Promise<number | null>((resolve) => {
      const video = document.createElement('video');
      const finish = () => {
        clearTimeout(timer);
        const duration = video.duration;
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute('src');
        video.load();
        resolve(Number.isFinite(duration) ? duration : null);
      };
      const timer = setTimeout(finish, 5000);
      video.preload = 'metadata';
      video.onloadedmetadata = finish;
      video.onerror = finish;
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
