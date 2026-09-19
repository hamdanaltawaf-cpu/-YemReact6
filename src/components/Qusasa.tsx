import { useId } from 'react';
/** The original Qusasa silhouette is preserved; gradients now have unique IDs. */
export function Qusasa({
  size = 32,
  tone = 'amber',
  className,
}: {
  size?: number;
  tone?: 'amber' | 'paper' | 'ink' | 'gradient';
  className?: string;
}) {
  const id = useId();
  const fill = {
    amber: 'var(--accent, #c1592e)',
    paper: '#f3eae0',
    ink: '#121214',
    gradient: `url(#${id})`,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0824b" />
          <stop offset="100%" stopColor="var(--accent, #c1592e)" />
        </linearGradient>
      </defs>
      <path
        fill={fill[tone]}
        fillRule="evenodd"
        d="M10,0 L86,0 L92,6 L98,1 L104,7 L110,3 L120,14 L120,106 L106,120 L14,120 L0,106 L0,10 Z M46,38 L46,82 L82,60 Z"
      />
    </svg>
  );
}
