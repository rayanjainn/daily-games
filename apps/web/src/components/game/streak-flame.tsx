import { cn } from '@/lib/cn';

export type StreakState = 'active' | 'at-risk' | 'out';

const SIZES = { sm: 'h-7', md: 'h-10', lg: 'h-16', xl: 'h-24' } as const;

/**
 * Streak flame. `active` flickers, `at-risk` (not played yet today) is an outlined flame,
 * `out` is grey.
 */
export function StreakFlame({
  count,
  state = 'active',
  size = 'md',
  showCount = true,
  className,
}: {
  count: number;
  state?: StreakState;
  size?: keyof typeof SIZES;
  showCount?: boolean;
  className?: string;
}) {
  const outer =
    state === 'out' ? 'var(--surface-3)' : state === 'at-risk' ? 'var(--surface)' : 'var(--pop)';
  const inner =
    state === 'out' ? 'var(--ink-faint)' : state === 'at-risk' ? 'var(--sun)' : 'var(--sun)';
  const label =
    state === 'out'
      ? `No active streak`
      : state === 'at-risk'
        ? `${count}-day streak, play today to keep it`
        : `${count}-day streak`;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 40 48"
        className={cn(SIZES[size], 'w-auto origin-bottom', state === 'active' && 'animate-flicker')}
        aria-hidden
      >
        <path
          d="M20 45c-9.4 0-16-6.4-16-15.2 0-6.9 4.4-11.6 7.8-15.6 2.4-2.8 4.3-6.2 4.6-10.7 0-.9 1-1.4 1.7-.8 5.2 4.3 7.4 9 7.6 13.6 1.4-1.4 2.4-3.3 2.8-5.4.2-.9 1.2-1.2 1.8-.6C33.7 13.6 36 19 36 25.8 36 37.6 29.4 45 20 45z"
          fill={outer}
          stroke="var(--line)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeDasharray={state === 'at-risk' ? '5 4' : undefined}
        />
        <path
          d="M20.5 41c-4.6 0-7.7-3-7.7-7.2 0-4.4 3.4-6.9 5.4-10 .4-.6 1.3-.5 1.5.2.8 2.3 2.2 3.7 3.8 4.6.5-1.1.8-2.3.8-3.6 0-.7.8-1.1 1.3-.6 2.4 2.2 3.4 5.2 3.4 8.4 0 4.9-3.5 8.2-8.5 8.2z"
          fill={inner}
          stroke="var(--line)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {showCount ? (
        <span
          className={cn(
            'font-display font-bold tabular-nums leading-none',
            size === 'sm' && 'text-lg',
            size === 'md' && 'text-2xl',
            size === 'lg' && 'text-4xl',
            size === 'xl' && 'text-5xl',
            state === 'out' && 'text-ink-faint',
          )}
          aria-hidden
        >
          {count}
        </span>
      ) : null}
    </span>
  );
}
