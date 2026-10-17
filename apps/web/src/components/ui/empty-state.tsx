import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const ART = {
  board: (
    <svg viewBox="0 0 120 96" className="h-24 w-auto" aria-hidden>
      <rect x="10" y="14" width="100" height="76" rx="16" fill="var(--edge)" />
      <rect
        x="10"
        y="8"
        width="100"
        height="76"
        rx="16"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="3"
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={22 + col * 21}
            y={20 + row * 20}
            width="16"
            height="15"
            rx="4"
            fill={
              row === 0 && col < 2
                ? 'var(--mint)'
                : row === 1 && col === 2
                  ? 'var(--sun)'
                  : 'var(--surface-3)'
            }
            stroke="var(--line)"
            strokeWidth="2"
          />
        )),
      )}
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 96" className="h-24 w-auto" aria-hidden>
      <circle cx="52" cy="46" r="28" fill="var(--sky)" stroke="var(--line)" strokeWidth="3" />
      <circle cx="52" cy="46" r="17" fill="var(--surface)" stroke="var(--line)" strokeWidth="3" />
      <path d="M73 66l20 18" stroke="var(--line)" strokeWidth="10" strokeLinecap="round" />
      <path d="M73 66l20 18" stroke="var(--sun)" strokeWidth="4" strokeLinecap="round" />
      <text
        x="52"
        y="53"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="20"
        fontWeight="700"
        fill="var(--ink)"
      >
        ?
      </text>
    </svg>
  ),
  oops: (
    <svg viewBox="0 0 120 96" className="h-24 w-auto" aria-hidden>
      <rect x="28" y="16" width="64" height="70" rx="14" fill="var(--edge)" />
      <rect
        x="28"
        y="10"
        width="64"
        height="70"
        rx="14"
        fill="var(--danger-soft)"
        stroke="var(--line)"
        strokeWidth="3"
      />
      <path
        d="M46 34l8 8m0-8l-8 8M66 34l8 8m0-8l-8 8"
        stroke="var(--line)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M48 62c6-6 18-6 24 0"
        fill="none"
        stroke="var(--line)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  ),
} as const;

export function EmptyState({
  art = 'board',
  title,
  children,
  action,
  className,
}: {
  art?: keyof typeof ART;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border-[length:var(--bw)] border-dashed border-line-soft bg-surface/60 px-6 py-10 text-center',
        className,
      )}
    >
      {ART[art]}
      <h3 className="text-xl">{title}</h3>
      {children ? <div className="max-w-sm text-ink-soft">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
