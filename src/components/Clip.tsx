'use client';
import { useRef, useEffect, useState } from 'react';
import { Bookmark, Download, Share2, VolumeX } from 'lucide-react';
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
        (reaction.media.endsWith('.webm') ? '.webm' : '.mp4');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      track('download', reaction.code);
      app.toast('المقطع صار عندك. خذه وحطّه!');
    } catch {
      app.toast('تعذّر التنزيل. جرّب مرة ثانية.');
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = location.origin + '/r/' + reaction.code;
    try {
      if (navigator.share)
        await navigator.share({ title: reaction.caption, text: reaction.situation, url });
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
      <button className="btn btn-primary" onClick={download} disabled={busy}>
        <Download size={18} />
        {busy ? 'لحظة...' : 'خذها'}
      </button>
      <button
        className={`btn btn-outline ${saved ? 'selected' : ''}`}
        onClick={() => app.toggleSave(reaction.code)}
        aria-pressed={saved}
      >
        <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'محفوظة' : 'احفظها'}
      </button>
      <button className="btn btn-outline" onClick={share}>
        <Share2 size={18} />
        شارك
      </button>
    </div>
  );
}
export function ClipPlayer({ reaction, active = true }: { reaction: Reaction; active?: boolean }) {
  const video = useRef<HTMLVideoElement>(null),
    [failed, setFailed] = useState(false);
  const counted = useRef(false);
  useEffect(() => {
    counted.current = false;
    setFailed(false);
  }, [reaction.code]);
  useEffect(() => {
    if (!active) video.current?.pause();
  }, [active]);
  return (
    <div className="clip-player">
      <video
        key={reaction.code}
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
        <source src={reaction.media} />
        {reaction.caption}
      </video>
      {failed && (
        <p className="media-error" role="alert">
          تعذّر تحميل المقطع. تحقق من الاتصال.
        </p>
      )}
      {reaction.isDemo && (
        <span className="demo-label">
          <VolumeX size={12} />
          نموذج متحرك بلا صوت • صورة مولّدة
        </span>
      )}
    </div>
  );
}
