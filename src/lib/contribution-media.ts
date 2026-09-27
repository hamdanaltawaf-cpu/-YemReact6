import { validateContributionDuration, type ContributionError } from './contributions';

/** Browser-only mock inspection: this never posts a file or claims server-grade media verification. */
export async function inspectContributionMedia(
  url: string,
  kind: 'image' | 'video',
): Promise<ContributionError | null> {
  if (kind === 'image') {
    const image = new Image();
    return new Promise((resolve) => {
      const timer = setTimeout(
        () =>
          resolve({
            title: 'تعذّر فتح الصورة',
            message: 'لم يستطع المتصفح قراءة الصورة. اختر صورة JPG أو PNG أو WebP سليمة.',
          }),
        10000,
      );
      image.onload = () => {
        clearTimeout(timer);
        resolve(
          image.naturalWidth && image.naturalHeight
            ? null
            : {
                title: 'الصورة غير صالحة',
                message: 'أبعاد الصورة غير قابلة للقراءة. اختر ملفًا آخر.',
              },
        );
      };
      image.onerror = () => {
        clearTimeout(timer);
        resolve({
          title: 'تعذّر فتح الصورة',
          message: 'الملف تالف أو غير مدعوم في هذا المتصفح. اختر صورة أخرى.',
        });
      };
      image.src = url;
    });
  }

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error('تعذّر قراءة بيانات الفيديو خلال 10 ثوانٍ.')),
        10000,
      );
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(Error('الملف تالف أو صيغة الفيديو غير مدعومة في هذا المتصفح. جرّب MP4 أو WebM.'));
      };
    });
    const durationError = validateContributionDuration(video.duration);
    if (durationError) return durationError;
    if (!video.videoWidth || !video.videoHeight)
      return {
        title: 'الفيديو غير صالح',
        message: 'تعذّر قراءة أبعاد المقطع. اختر ملف فيديو آخر.',
      };
    // Sample two frames conservatively. Uniform black edge bands with a visible
    // centre are evidence of encoded bars; dark cinematic scenes are not rejected.
    const samples = [Math.min(video.duration * 0.2, video.duration - 0.1), video.duration * 0.55];
    let blackBarFrames = 0;
    let checkedFrames = 0;
    for (const timestamp of samples) {
      if (!(await seek(video, timestamp)))
        return {
          title: 'تعذّر فحص حواف الفيديو',
          message:
            'لم يمكن قراءة إطارات هذا الفيديو للتحقق من الحواف السوداء. جرّب MP4 أو WebM صالحًا.',
        };
      try {
        if (hasBlackBars(video)) blackBarFrames++;
        checkedFrames++;
      } catch {
        return {
          title: 'تعذّر فحص حواف الفيديو',
          message: 'لا يسمح المتصفح بفحص إطارات هذا المقطع. جرّب MP4 أو WebM صالحًا.',
        };
      }
    }
    if (checkedFrames === 2 && blackBarFrames === 2)
      return {
        title: 'المقطع يحتوي فراغًا أسود',
        message: 'ظهرت أشرطة سوداء ثابتة حول الصورة. صدّر المقطع بلا حواف سوداء ثم جرّب ملفًا آخر.',
      };
    return null;
  } catch (failure) {
    return {
      title: 'تعذّر فحص الفيديو',
      message: failure instanceof Error ? failure.message : 'لم يمكن قراءة الملف. جرّب فيديو آخر.',
    };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeek);
      video.removeEventListener('error', onError);
      resolve(ok);
    };
    const onSeek = () => finish(true);
    const onError = () => finish(false);
    video.addEventListener('seeked', onSeek, { once: true });
    video.addEventListener('error', onError, { once: true });
    timer = setTimeout(() => finish(false), 1800);
    try {
      video.currentTime = Math.max(0, time);
    } catch {
      finish(false);
    }
  });
}

function hasBlackBars(video: HTMLVideoElement) {
  const width = 160;
  const height = Math.max(
    80,
    Math.min(320, Math.round((width * video.videoHeight) / video.videoWidth)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw Error('canvas unavailable');
  context.drawImage(video, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const darkFraction = (horizontal: boolean, fraction: number) => {
    const line = Math.round((horizontal ? height : width) * fraction);
    const length = horizontal ? width : height;
    let dark = 0;
    for (let i = 0; i < length; i += 3) {
      const x = horizontal ? i : line;
      const y = horizontal ? line : i;
      const pos = (y * width + x) * 4;
      if (pixels[pos] < 19 && pixels[pos + 1] < 19 && pixels[pos + 2] < 19) dark++;
    }
    return dark / Math.ceil(length / 3);
  };
  let centreBrightness = 0;
  let count = 0;
  for (let y = Math.round(height * 0.34); y < Math.round(height * 0.66); y += 5)
    for (let x = Math.round(width * 0.34); x < Math.round(width * 0.66); x += 5) {
      const i = (y * width + x) * 4;
      centreBrightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      count++;
    }
  if (centreBrightness / Math.max(count, 1) < 48) return false;
  const topBottom =
    [0.04, 0.09].every((fraction) => darkFraction(true, fraction) > 0.96) &&
    [0.91, 0.96].every((fraction) => darkFraction(true, fraction) > 0.96);
  const leftRight =
    [0.04, 0.09].every((fraction) => darkFraction(false, fraction) > 0.96) &&
    [0.91, 0.96].every((fraction) => darkFraction(false, fraction) > 0.96);
  return topBottom || leftRight;
}
