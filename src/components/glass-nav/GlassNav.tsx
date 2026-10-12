'use client';

/**
 * GlassNav — شريط التنقل الزجاجي (كبسولة عائمة، ٥ تبويبات، RTL)
 * ---------------------------------------------------------------------
 * • يعمل كتنقّل حقيقي عبر next/link (المكتبة / المجموعات / المحفوظات / اضافة)
 * • تبويب «الحساب» بلا href — يُنفَّذ عبر onSelect (يفتح قائمة الحساب في Header)
 * • التحديد النشط يُستنتج تلقائياً من المسار الحالي، ويمكن فرضه بـ activeKey
 * • كل أيقونة طبقتان: مخطط (s-o) ↔ ممتلئ بتدرّج ناعم (s-f) — مطابق للتصميم
 * • الأسهم تنقل بين التبويبات مع احترام اتجاه RTL
 *
 * الاستخدام المستقل:
 *   import { GlassNav } from '@/components/glass-nav/GlassNav';
 *   <GlassNav onSelect={(key) => …} />
 *
 * ملاحظة SSR: معرّفات التدرّجات مبنية على useId حتى تتطابق بين الخادم والعميل.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import './glass-nav.css';

export type GlassTabKey = 'library' | 'groups' | 'add' | 'saved' | 'account';

export type GlassTab = {
  key: GlassTabKey;
  /** النص الظاهر — مطابق لصيغة المستخدم: اضافة بلا همزة */
  label: string;
  /** عند وجوده يُرسَم التبويب كرابط تنقّل */
  href?: string;
  /** وصف قارئ الشاشة عند الحاجة لصيغة مغايرة */
  aria?: string;
  /** هل المسار الحالي ينتمي لهذا التبويب؟ */
  isCurrent?: (pathname: string) => boolean;
};

export type GlassNavProps = {
  tabs?: GlassTab[];
  /** فرض التبويب النشط (يتجاوز استنتاج المسار) */
  activeKey?: GlassTabKey;
  /** يُنادى عند كل تنشيط، قبل الانتقال */
  onSelect?: (key: GlassTabKey, tab: GlassTab) => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
};

/* ------------------------------- المسارات ------------------------------- */
const startsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const DEFAULT_TABS: GlassTab[] = [
  {
    key: 'library',
    label: 'المكتبة',
    aria: 'المكتبة',
    href: '/library',
    isCurrent: (p) => p === '/library' || p.startsWith('/r/'),
  },
  {
    key: 'groups',
    label: 'المجموعات',
    aria: 'المجموعات',
    href: '/collections',
    isCurrent: startsWith('/collections'),
  },
  {
    key: 'add',
    label: 'اضافة',
    aria: 'إضافة رياكشن',
    href: '/contribute',
    isCurrent: startsWith('/contribute'),
  },
  {
    key: 'saved',
    label: 'المحفوظات',
    aria: 'المحفوظات',
    href: '/saved',
    isCurrent: startsWith('/saved'),
  },
  {
    key: 'account',
    label: 'الحساب',
    aria: 'الحساب',
    isCurrent: (p) => p.startsWith('/account') || p.startsWith('/login'),
  },
];

/* -------------------------- الأيقونات (طبقتان) -------------------------- */
/* التدرّج يُقرأ من متغيّرات CSS حتى يتكيّف مع الوضع الداكن دون تكرار الأيقونات. */
const G_STOPS = [
  { offset: '0', v: '--gnav-g1' },
  { offset: '.14', v: '--gnav-g2' },
  { offset: '.27', v: '--gnav-g3' },
  { offset: '.37', v: '--gnav-g4' },
  { offset: '.62', v: '--gnav-g5' },
  { offset: '1', v: '--gnav-g6' },
];

function GlyphGradient({ uid }: { uid: string }) {
  return (
    <>
      <linearGradient id={`${uid}-gv`} x1="0" y1="0" x2="0" y2="1">
        {G_STOPS.map((s) => (
          <stop key={s.offset} offset={s.offset} style={{ stopColor: `var(${s.v})` }} />
        ))}
      </linearGradient>
      <radialGradient id={`${uid}-gr`} cx=".5" cy=".45" r=".62">
        <stop offset="0" style={{ stopColor: 'var(--gnav-vg, #050505)' }} stopOpacity="0" />
        <stop offset=".45" style={{ stopColor: 'var(--gnav-vg, #050505)' }} stopOpacity="0" />
        <stop offset="1" style={{ stopColor: 'var(--gnav-vg, #050505)' }} stopOpacity=".46" />
      </radialGradient>
    </>
  );
}

const HOUSE_D =
  'M42.12 1.22C41.98 1.35 41.18 1.72 40.33 2.07C38.3 2.9 34.98 5.57 27.5 12.38C26.75 13.07 24.95 14.65 23.53 15.88C18.77 19.97 17.77 20.85 15.23 23.12C13.85 24.35 12.38 25.6 11.98 25.9C8.53 28.4 5.55 32.45 4.55 35.97C3.83 38.45 3.95 77.78 4.65 80C6 84.15 9.35 87.97 12.8 89.3C19.2 91.72 31.25 90.75 34.35 87.55C37.12 84.67 37.27 83.97 37.23 73.62C37.18 64.2 37.27 63.67 39.3 61.38C43.75 56.32 52.3 58.02 54.2 64.33C54.73 66.05 54.75 66.62 54.75 74.6C54.75 83.83 54.85 84.55 56.43 86.28C56.73 86.62 57 87.05 57 87.2C57 89.95 72.12 91.83 77.75 89.78C80.45 88.78 81.65 88.03 83.68 85.92C87.73 81.78 87.73 81.8 87.75 58.25C87.8 32.32 87.93 32.95 81.18 27.1C79.62 25.75 78.05 24.35 77.62 23.97C76.9 23.33 74.58 21.27 69.38 16.75C68.03 15.58 66.25 14.02 65.4 13.3C64.55 12.55 63.65 11.75 63.38 11.52C63.1 11.27 61.03 9.45 58.75 7.47C52.2 1.72 50.75 1 45.85 1C43.93 1 42.25 1.1 42.12 1.22Z';

const Icons: Record<GlassTabKey, (props: { uid: string }) => JSX.Element> = {
  library: ({ uid }) => (
    <svg viewBox="0 0 92 92" aria-hidden="true" focusable="false">
      <defs>
        <GlyphGradient uid={uid} />
      </defs>
      <g
        className="s-o"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={HOUSE_D} />
      </g>
      <g className="s-f" strokeLinecap="round" strokeLinejoin="round">
        <path d={HOUSE_D} fill={`url(#${uid}-gv)`} />
        <path d={HOUSE_D} fill={`url(#${uid}-gr)`} />
      </g>
    </svg>
  ),
  groups: ({ uid }) => (
    <svg viewBox="0 0 92 92" aria-hidden="true" focusable="false">
      <defs>
        <GlyphGradient uid={uid} />
      </defs>
      <g
        className="s-o"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 33 L46 18 L72 33 L46 48 Z" />
        <path d="M20 45 L46 60 L72 45" />
        <path d="M20 60 L46 75 L72 60" />
      </g>
      <g className="s-f" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M20 33 L46 18 L72 33 L46 48 Z"
          fill={`url(#${uid}-gv)`}
          stroke={`url(#${uid}-gv)`}
          strokeWidth="7"
        />
        <path d="M20 45 L46 60 L72 45" fill="none" stroke={`url(#${uid}-gv)`} strokeWidth="11" />
        <path d="M20 60 L46 75 L72 60" fill="none" stroke={`url(#${uid}-gv)`} strokeWidth="11" />
        <path d="M20 33 L46 18 L72 33 L46 48 Z" fill={`url(#${uid}-gr)`} stroke="none" />
      </g>
    </svg>
  ),
  add: ({ uid }) => (
    <svg viewBox="0 0 92 92" aria-hidden="true" focusable="false">
      <defs>
        <GlyphGradient uid={uid} />
      </defs>
      <g
        className="s-o"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 46 H77 M46 15 V77" strokeWidth="13" />
      </g>
      <g className="s-f" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 46 H77 M46 15 V77" fill="none" stroke={`url(#${uid}-gv)`} strokeWidth="13" />
      </g>
    </svg>
  ),
  saved: ({ uid }) => (
    <svg viewBox="0 0 92 92" aria-hidden="true" focusable="false">
      <defs>
        <GlyphGradient uid={uid} />
      </defs>
      <g
        className="s-o"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 10 H74 V82 L46 62 L18 82 Z" />
      </g>
      <g className="s-f" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M18 10 H74 V82 L46 62 L18 82 Z"
          fill={`url(#${uid}-gv)`}
          stroke={`url(#${uid}-gv)`}
          strokeWidth="9"
        />
        <path d="M18 10 H74 V82 L46 62 L18 82 Z" fill={`url(#${uid}-gr)`} stroke="none" />
      </g>
    </svg>
  ),
  account: ({ uid }) => (
    <svg viewBox="0 0 92 92" aria-hidden="true" focusable="false">
      <defs>
        <GlyphGradient uid={uid} />
      </defs>
      <g
        className="s-o"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="46" cy="28" r="19" />
        <path d="M18 74 A28 20 0 0 1 74 74 M18 74 V84 M74 74 V84" />
      </g>
      <g className="s-f" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="46" cy="28" r="19" fill={`url(#${uid}-gv)`} />
        <path
          d="M18 84 V74 A28 20 0 0 1 74 74 V84 Z"
          fill={`url(#${uid}-gv)`}
          stroke={`url(#${uid}-gv)`}
          strokeWidth="6"
        />
        <circle cx="46" cy="28" r="19" fill={`url(#${uid}-gr)`} />
        <path d="M18 84 V74 A28 20 0 0 1 74 74 V84 Z" fill={`url(#${uid}-gr)`} stroke="none" />
      </g>
    </svg>
  ),
};

/* --------------------------------- المكوّن -------------------------------- */
export function GlassNav({
  tabs = DEFAULT_TABS,
  activeKey,
  onSelect,
  className = '',
  style,
  ariaLabel = 'التنقل الرئيسي',
}: GlassNavProps) {
  const pathname = usePathname() || '/';
  // useId ثابت بين الخادم والعميل — وتُنقّى رموزه ليبقى المعرّف صالحاً داخل url(#…)
  const uid = `gnav${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [pulse, setPulse] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const derived = tabs.find((t) => t.isCurrent?.(pathname))?.key;
  const active = activeKey ?? derived ?? tabs[0]?.key;

  const activate = useCallback(
    (tab: GlassTab, node?: HTMLElement | null) => {
      if (tab.key === 'add') {
        setPulse(tab.key);
        window.setTimeout(() => setPulse((p) => (p === tab.key ? null : p)), 460);
      }
      onSelect?.(tab.key, tab);
    },
    [onSelect],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const order = tabs.map((t) => t.key);
      // تُحسب الخطوة من التبويب المُركَّز عليه حاليًا لا من النشط،
      // حتى يعود السهم المقابل إلى التبويب السابق بدل القفز من موضع التحديد.
      const focusedKey = (event.currentTarget.ownerDocument.activeElement as HTMLElement | null)
        ?.dataset?.key;
      const from: GlassTabKey | undefined =
        focusedKey && order.includes(focusedKey as GlassTabKey)
          ? (focusedKey as GlassTabKey)
          : active;
      const index = from ? order.indexOf(from) : 0;
      if (index < 0) return;
      const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
      let step = 0;
      if (event.key === 'ArrowRight') step = rtl ? -1 : 1;
      else if (event.key === 'ArrowLeft') step = rtl ? 1 : -1;
      else if (event.key === 'Home') step = -index;
      else if (event.key === 'End') step = order.length - 1 - index;
      if (!step) return;
      event.preventDefault();
      const next = order[(index + step + order.length) % order.length];
      const node = event.currentTarget.querySelector<HTMLElement>(`[data-key="${next}"]`);
      node?.focus({ preventScroll: true });
    },
    [tabs, active],
  );

  return (
    <nav
      ref={navRef}
      className={`glass-nav ${className}`.trim()}
      style={style}
      dir="rtl"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const Icon = Icons[tab.key];
        const isActive = tab.key === active;
        const inner = (
          <>
            <span className="gnav-ico">{Icon ? <Icon uid={uid} /> : null}</span>
            <span className="gnav-lab">{tab.label}</span>
          </>
        );
        const shared = {
          'data-key': tab.key,
          'data-active': isActive ? 'true' : 'false',
          className: `gnav-tab${pulse === tab.key ? ' is-pulsing' : ''}`,
          'aria-label': tab.aria || tab.label,
        } as const;

        return tab.href ? (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => activate(tab, event.currentTarget)}
            {...shared}
          >
            {inner}
          </Link>
        ) : (
          <button
            key={tab.key}
            type="button"
            onClick={(event) => activate(tab, event.currentTarget)}
            {...shared}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}

export default GlassNav;
