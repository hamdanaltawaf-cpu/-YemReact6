'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type FormEvent } from 'react';
import { Bookmark, Check, Copy, Flag, MoreHorizontal, Share2 } from 'lucide-react';
import type { Reaction } from '@/lib/reactions';
import { useApp, track } from './AppProvider';
import { Modal } from './ui/Modal';

const reasons = ['حقوق المحتوى', 'محتوى غير مناسب', 'رابط لا يعمل', 'أخرى'] as const;

export function ReactionMenu({
  reaction,
  detail = false,
}: {
  reaction: Reaction;
  detail?: boolean;
}) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState<(typeof reasons)[number]>(reasons[0]);
  const [description, setDescription] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const saved = app.saved.includes(reaction.code);
  const url = () => `${window.location.origin}/r/${encodeURIComponent(reaction.code)}`;

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [open]);
  function dismiss() {
    setOpen(false);
    trigger.current?.focus();
  }
  async function copy() {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(url());
      app.toast('تم نسخ رابط الرياكشن');
    } catch {
      app.toast('تعذّر نسخ الرابط؛ يمكنك نسخه من شريط العنوان.');
    }
  }
  async function share() {
    setOpen(false);
    try {
      if (navigator.share) await navigator.share({ title: reaction.caption, url: url() });
      else {
        await navigator.clipboard.writeText(url());
        app.toast('تم نسخ الرابط للمشاركة');
      }
      track('share', reaction.code);
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === 'AbortError'))
        app.toast('تعذّرت المشاركة. جرّب نسخ الرابط.');
    }
  }
  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []),
    ];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }
  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: reaction.code, reason, detail: description }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'تعذّر إرسال البلاغ.');
      setReporting(false);
      setDescription('');
      app.toast('وصلنا بلاغك. شكرًا لتنبيهنا.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'تعذّر إرسال البلاغ.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={`reaction-menu${detail ? ' detail-menu' : ''}`} ref={root}>
        <button
          ref={trigger}
          type="button"
          className="reaction-menu-trigger"
          aria-label={`خيارات ${reaction.caption}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => {
            if (!open) {
              // Grid masonry can reorder columns: use the trigger's actual viewport position.
              const bounds = trigger.current?.getBoundingClientRect();
              setAlignRight(
                Boolean(bounds && bounds.left + 190 > document.documentElement.clientWidth - 8),
              );
            }
            setOpen((value) => !value);
          }}
        >
          <MoreHorizontal size={19} aria-hidden="true" />
        </button>
        {open && (
          <div
            className="reaction-menu-panel"
            data-align={alignRight ? 'right' : 'left'}
            id={id}
            role="menu"
            ref={menu}
            onKeyDown={onMenuKey}
          >
            {!detail && (
              <>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void app.toggleSave(reaction.code);
                  }}
                >
                  {saved ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Bookmark size={16} aria-hidden="true" />
                  )}
                  {saved ? 'إزالة من المحفوظات' : 'حفظ'}
                </button>
                <button role="menuitem" type="button" onClick={share}>
                  <Share2 size={16} aria-hidden="true" /> مشاركة
                </button>
              </>
            )}
            <button role="menuitem" type="button" onClick={copy}>
              <Copy size={16} aria-hidden="true" /> نسخ الرابط
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                setReporting(true);
              }}
            >
              <Flag size={16} aria-hidden="true" /> إبلاغ
            </button>
          </div>
        )}
      </div>
      {reporting && (
        <Modal
          open
          title={`الإبلاغ عن ${reaction.caption}`}
          onClose={() => {
            if (!busy) {
              setReporting(false);
              trigger.current?.focus();
            }
          }}
        >
          <form className="stack-form report-form" onSubmit={report}>
            <label>
              سبب البلاغ
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value as (typeof reasons)[number])}
              >
                {reasons.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              توضيح إضافي (اختياري)
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={3}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-dark" type="submit" disabled={busy}>
              {busy ? 'جارٍ الإرسال…' : 'إرسال البلاغ'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
