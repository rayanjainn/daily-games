import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { cn } from '@/lib/cn';
import { BRAND } from '@everydaily/shared';

/** Centered single-column frame for sign-up, sign-in and recovery screens. */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 rounded-md">
          <LogoMark className="size-9" />
          <span className="font-display text-lg font-bold">{BRAND.name}</span>
        </Link>
        <ThemeToggle />
      </header>
      <main
        className={cn(
          'mx-auto flex w-full flex-1 flex-col px-4 pb-10 pt-2 sm:px-6 sm:pt-8',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function StepDots({
  total,
  current,
  labels,
}: {
  total: number;
  current: number;
  labels: string[];
}) {
  return (
    <ol
      className="mb-6 flex items-center gap-2"
      aria-label={`Step ${current + 1} of ${total}: ${labels[current]}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          aria-hidden
          className={cn(
            'h-2.5 rounded-pill border-2 border-line transition-all duration-[var(--dur-base)]',
            i < current ? 'w-6 bg-mint' : i === current ? 'w-10 bg-pop' : 'w-6 bg-surface',
          )}
        />
      ))}
    </ol>
  );
}

export function StepHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-1 font-display text-sm font-semibold uppercase tracking-wider text-ink-soft">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {children ? <div className="mt-2 text-ink-soft">{children}</div> : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(
        'rounded-lg border-2 p-3.5 text-sm',
        tone === 'info' && 'border-info/30 bg-info-soft text-info',
        tone === 'warn' && 'border-warn/30 bg-warn-soft text-warn',
        tone === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
        className,
      )}
    >
      {children}
    </div>
  );
}
