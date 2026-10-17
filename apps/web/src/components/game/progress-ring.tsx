'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function ProgressRing({
  value,
  max,
  size = 120,
  stroke = 14,
  color = 'var(--mint)',
  label,
  sublabel,
  className,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
  sublabel?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2 - 2;
  const c = size / 2;
  const complete = max > 0 && value >= max;

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={`${value} of ${max} done`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle cx={c} cy={c + 3} r={r} fill="none" stroke="var(--edge)" strokeWidth={stroke + 5} />
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke + 5} />
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: reduce ? pct : 0 }}
          animate={{ pathLength: pct }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 18 }}
          style={{ opacity: pct === 0 ? 0 : 1 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div className="flex flex-col items-center leading-none">
          <span
            className={cn(
              'font-display font-bold tabular-nums',
              size >= 100 ? 'text-3xl' : size >= 72 ? 'text-lg' : 'text-xs',
            )}
          >
            {label ?? `${value}/${max}`}
          </span>
          {size < 72 ? null : sublabel ? (
            <span className="mt-1 font-display text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {sublabel}
            </span>
          ) : complete ? (
            <span className="mt-1 font-display text-xs font-semibold uppercase tracking-wide text-success">
              All done
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
