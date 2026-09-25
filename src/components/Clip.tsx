'use client';
import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { verifiedMediaType, mediaFileExtension } from '@/lib/media';
import { Bookmark, Download, Share2 } from 'lucide-react';
import { useApp, track } from './AppProvider';
import type { Reaction } from '@/lib/reactions';
/** Shared media primitives stay separate from the on-demand animation bundle. */
export function ReactionActions({ reaction }: { reaction: Reaction }) {
  const app = useApp(),
    [busy, setBusy] = useState(false);
  const saved = app.saved.includes(reaction.code);
  async function download() {
    setBusy(true);
    try {
      const r = await fetch(reaction.media);
      if (!r.ok) throw Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download =
        (reaction.caption
          .replace(/[\\/:*?"<>|\x00-\x1F]/g, '')
          .trim()
          .slice(0, 80) || 'yemreact') +
        (reaction.isDemo ? '-demo' : '') +
        mediaFileExtension(reaction.media, blob.type);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      track('download', reaction.code);
      app.toast('تم تنزيل الملف.');
    } catch {
      app.toast('تعذّر التنزيل. جرّب مرة ثانية.');
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = location.origin + '/r/' + reaction.code;
    try {
      if (navigator.share) await navigator.share({ title: reaction.caption, url });
      else {
        await navigator.clipboard.writeText(url);
        app.toast('نسخنا رابط الرياكشن');
      }
      track('share', reaction.code);
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        app.toast('تعذّرت المشاركة. يمكنك نسخ الرابط من شريط العنوان.');
      }
    }
  }
  return (
    <div className="reaction-actions">
      <button
        className={`btn btn-outline ${saved ? 'selected' : ''}`}
        aria-label={saved ? 'إزالة من المحفوظات' : 'حفظ'}
        onClick={() => app.toggleSave(reaction.code)}
        aria-pressed={saved}
      >
        <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        <span>{saved ? 'محفوظ' : 'حفظ'}</span>
      </button>
      <button
        className="btn btn-primary"
        aria-label={busy ? 'جارٍ التنزيل' : 'تنزيل'}
        onClick={download}
        disabled={busy || verifiedMediaType(reaction) === 'unknown'}
      >
        <Download size={18} aria-hidden="true" />
        <span>{busy ? 'لحظة…' : 'تنزيل'}</span>
      </button>
      <button className="btn btn-outline" aria-label="مشاركة" onClick={share}>
        <Share2 size={18} aria-hidden="true" />
        <span>مشاركة</span>
      </button>
    </div>
  );
}
export function ClipPlayer({ reaction, active = true }: { reaction: Reaction; active?: boolean }) {
  const video = useRef<HTMLVideoElement>(null),
    [failed, setFailed] = useState(false);
  const counted = useRef(false);
  const kind = verifiedMediaType(reaction);
  const isImage = kind === 'image';
  useEffect(() => {
    counted.current = false;
    setFailed(false);
  }, [reaction.code, reaction.media]);
  useEffect(() => {
    if (!active) video.current?.pause();
  }, [active]);
  return (
    <div className="clip-player">
      {isImage ? (
        <Image
          key={`${reaction.code}:${reaction.media}`}
          src={reaction.media}
          alt={reaction.caption}
          fill
          sizes="(max-width: 600px) 90vw, 600px"
          className="clip-still"
          onError={() => setFailed(true)}
        />
      ) : kind === 'video' ? (
        <video
          key={`${reaction.code}:${reaction.media}`}
          ref={video}
          controls
          aria-label={`معاينة ${reaction.caption}`}
          playsInline
          loop
          preload="none"
          poster={reaction.poster}
          onError={() => setFailed(true)}
          onPlay={() => {
            if (!counted.current) {
              track('play', reaction.code);
              counted.current = true;
            }
          }}
        >
          <source src={reaction.media} type={reaction.mimeType || undefined} />
          {reaction.caption}
        </video>
      ) : (
        <p className="media-error" role="status">
          هذا الملف غير متاح للمعاينة حاليًا.
        </p>
      )}
      {failed && (
        <p className="media-error" role="alert">
          تعذّر تحميل الملف. تحقق من الاتصال.
        </p>
      )}
    </div>
  );
}
