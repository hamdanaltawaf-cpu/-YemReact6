'use client';
import Link from 'next/link';
import { useRef, type TouchEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { verifiedMediaType } from '@/lib/media';
import { distinctSituation } from '@/lib/reaction-copy';
import { useApp } from './AppProvider';
import { Modal } from './ui/Modal';
import { ClipPlayer, ReactionActions } from './Clip';

const interactiveTouchTarget =
  'button, a, input, select, textarea, summary, video, [role="button"], [contenteditable="true"]';

export function Preview() {
  const app = useApp(),
    index = app.reactions.findIndex((r) => r.code === app.preview),
    r = app.reactions[index];
  const situation = r ? distinctSituation(r.caption, r.situation) : null;
  const touch = useRef<{ x: number; blocked: boolean } | null>(null);
  const reduced = useReducedMotion() || app.reduced;
  function startSwipe(event: TouchEvent<HTMLDivElement>) {
    const target = event.target;
    const startsOnMedia = target instanceof Element && target.closest('.clip-player');
    const startsOnControl = target instanceof Element && target.closest(interactiveTouchTarget);
    touch.current =
      startsOnMedia && !startsOnControl ? { x: event.touches[0].clientX, blocked: false } : null;
  }
  function moveSwipe(event: TouchEvent<HTMLDivElement>) {
    const gesture = touch.current;
    if (!gesture) return;
    const target = document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY);
    if (
      !(target instanceof Element) ||
      !target.closest('.clip-player') ||
      target.closest(interactiveTouchTarget)
    ) {
      gesture.blocked = true;
    }
  }
  function finishSwipe(event: TouchEvent<HTMLDivElement>) {
    const gesture = touch.current;
    touch.current = null;
    if (!gesture || gesture.blocked) return;
    const delta = event.changedTouches[0].clientX - gesture.x;
    if (Math.abs(delta) > 100) {
      app.setPreview(
        app.reactions[(index + (delta > 0 ? 1 : -1) + app.reactions.length) % app.reactions.length]
          .code,
      );
    }
  }
  return (
    <Modal
      open={!!r}
      onClose={() => app.setPreview(null)}
      title={
        r && verifiedMediaType(r) === 'image'
          ? 'معاينة الصورة'
          : r && verifiedMediaType(r) === 'video'
            ? 'مشغّل الفيديو'
            : 'معاينة الملف'
      }
      wide
    >
      {r && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          className="preview-grid"
          onTouchStart={startSwipe}
          onTouchMove={moveSwipe}
          onTouchEnd={finishSwipe}
          onTouchCancel={() => {
            touch.current = null;
          }}
        >
          <ClipPlayer reaction={r} active={!!app.preview} />
          <div className="preview-copy">
            <h3>{r.caption}</h3>
            {r.characterName && (
              <span className="character-chip" title={r.characterName}>
                {r.characterName}
              </span>
            )}
            {situation && (
              <details className="detail-secondary">
                <summary>الوصف الثنائي</summary>
                <p>{situation}</p>
              </details>
            )}
            <ReactionActions reaction={r} />
            {r.isDemo && (
              <p className="demo-disclosure">
                هذه معاينة تجريبية مصنوعة من صورة مولّدة، وليست مشهدًا أصليًا أو أداءً لشخص حقيقي.
              </p>
            )}
            <Link
              className="text-button"
              href={`/r/${r.code}`}
              onClick={() => app.setPreview(null)}
            >
              كل تفاصيل الرياكشن <ExternalLink size={15} />
            </Link>
            <div className="preview-navigation">
              <button
                className="icon-btn"
                aria-label="الرياكشن السابق"
                onClick={() =>
                  app.setPreview(
                    app.reactions[(index - 1 + app.reactions.length) % app.reactions.length].code,
                  )
                }
              >
                <ArrowRight size={20} />
              </button>
              <button
                className="icon-btn"
                aria-label="الرياكشن التالي"
                onClick={() =>
                  app.setPreview(app.reactions[(index + 1) % app.reactions.length].code)
                }
              >
                <ArrowLeft size={20} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </Modal>
  );
}
