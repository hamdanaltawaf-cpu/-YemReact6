'use client';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { useApp } from './AppProvider';
import { Modal } from './ui/Modal';
import { CAT_BY_ID } from '@/lib/categories';
import { ClipPlayer, ReactionActions } from './Clip';
export function Preview() {
  const app = useApp(),
    index = app.reactions.findIndex((r) => r.code === app.preview),
    r = app.reactions[index];
  const touch = useRef(0);
  const reduced = useReducedMotion() || app.reduced;
  return (
    <Modal open={!!r} onClose={() => app.setPreview(null)} title="لقطة في محلّها" wide>
      {r && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          className="preview-grid"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientX - touch.current;
            if (Math.abs(delta) > 100 && !(e.target as HTMLElement).closest('video'))
              app.setPreview(
                app.reactions[
                  (index + (delta > 0 ? 1 : -1) + app.reactions.length) % app.reactions.length
                ].code,
              );
          }}
        >
          <ClipPlayer reaction={r} active={!!app.preview} />
          <div className="preview-copy">
            <span className="eyebrow">
              {CAT_BY_ID[r.category].name} <span className="mono">/ {r.code}</span>
            </span>
            <h3>{r.caption}</h3>
            <p>{r.situation}</p>
            <div className="tags">
              {r.keywords.map((k) => (
                <Link
                  onClick={() => app.setPreview(null)}
                  href={`/library?q=${encodeURIComponent(k)}`}
                  key={k}
                >
                  #{k}
                </Link>
              ))}
            </div>
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
              <span className="mono">
                {index + 1} / {app.reactions.length}
              </span>
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
