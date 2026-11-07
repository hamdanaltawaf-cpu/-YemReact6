'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CircleAlert, FileQuestion, SearchX, ShieldAlert, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '@/components/AppProvider';

export type StateKind = 'empty' | 'error' | 'not-found' | 'offline' | 'permission' | 'loading';
const icons = {
  empty: SearchX,
  error: CircleAlert,
  'not-found': FileQuestion,
  offline: WifiOff,
  permission: ShieldAlert,
};

/** Keep this boundary mounted and toggle visible to allow an exit animation. */
export function StatePanel({
  kind,
  title,
  description,
  action,
  children,
  visible = true,
  heading = 'h1',
}: {
  kind: StateKind;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  visible?: boolean;
  heading?: 'h1' | 'h2';
}) {
  const { reduced } = useApp();
  const systemReduced = useReducedMotion();
  const quiet = reduced || systemReduced;
  const Heading = heading;
  const Icon = kind === 'loading' ? null : icons[kind];
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={kind}
          role={kind === 'error' ? 'alert' : 'status'}
          aria-live={kind === 'error' ? 'assertive' : 'polite'}
          aria-busy={kind === 'loading' ? true : undefined}
          className={`state-panel state-panel--${kind}`}
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: quiet ? 1 : 0.985 }}
          transition={{ duration: quiet ? 0 : 0.16 }}
        >
          {Icon && (
            <span className="state-panel-icon" aria-hidden="true">
              <Icon size={28} />
            </span>
          )}
          <Heading>{title}</Heading>
          {description && <p>{description}</p>}
          {children}
          {action && <div className="state-panel-action">{action}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
