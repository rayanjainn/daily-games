import { BRAND } from '@everydaily/shared';
import { cn } from '@/lib/cn';

/** Original mark: a lifted tile holding a three-line checklist, the top line ticked. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('size-10', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="3" y="6" width="42" height="40" rx="11" fill="var(--edge)" />
      <rect
        x="3"
        y="2"
        width="42"
        height="40"
        rx="11"
        fill="var(--pop)"
        stroke="var(--line)"
        strokeWidth="3"
      />
      <circle
        cx="14"
        cy="13.5"
        r="4.5"
        fill="var(--mint)"
        stroke="var(--on-pop)"
        strokeWidth="2.5"
      />
      <path
        d="M12 13.6l1.5 1.5 3-3.2"
        fill="none"
        stroke="var(--on-pop)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="22" y="11" width="16" height="5" rx="2.5" fill="var(--on-pop)" />
      <circle
        cx="14"
        cy="23.5"
        r="4.5"
        fill="var(--surface)"
        stroke="var(--on-pop)"
        strokeWidth="2.5"
      />
      <rect x="22" y="21" width="13" height="5" rx="2.5" fill="var(--on-pop)" opacity="0.85" />
      <circle
        cx="14"
        cy="33.5"
        r="4.5"
        fill="var(--surface)"
        stroke="var(--on-pop)"
        strokeWidth="2.5"
      />
      <rect x="22" y="31" width="10" height="5" rx="2.5" fill="var(--on-pop)" opacity="0.7" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {compact ? (
        <span className="sr-only">{BRAND.name}</span>
      ) : (
        <span className="font-display text-xl font-bold tracking-tight text-ink">{BRAND.name}</span>
      )}
    </span>
  );
}
