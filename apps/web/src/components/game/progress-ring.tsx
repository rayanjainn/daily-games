'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2 - 2;
  const c = size / 2;
  const complete = max > 0 && value >= max;
  // Start empty and fill on mount; CSS turns the transition off under reduced motion.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

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
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - shown}
          style={{
            opacity: pct === 0 ? 0 : 1,
            transition: 'stroke-dashoffset 700ms var(--ease-out)',
          }}
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
