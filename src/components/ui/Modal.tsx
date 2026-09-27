'use client';
import { useEffect, useRef, type ReactNode, useId } from 'react';
import { X } from 'lucide-react';
/** Native dialog supplies focus trapping, Escape handling and inert background content. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  sheet = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  sheet?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('[autofocus]')?.focus();
    }
    if (!open && d.open) d.close();
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal-wide' : ''}${sheet ? ' modal-sheet' : ''}`}
      aria-labelledby={id}
      onCancel={(event) => {
        // A validation dialog can sit inside another dialog. Escape closes only the topmost one.
        event.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-top">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" aria-label="إغلاق" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
