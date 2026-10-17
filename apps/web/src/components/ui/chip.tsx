import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Toggleable filter chip. Renders a button with aria-pressed. */
export function Chip({
  selected = false,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border-[length:var(--bw)] border-line px-3.5',
        'font-display text-sm font-medium transition-[transform,background-color,box-shadow] duration-[var(--dur-fast)]',
        'shadow-lift-sm active:translate-y-[var(--lift-sm)] active:shadow-none',
        selected ? 'bg-ink text-paper' : 'bg-surface text-ink hover:bg-surface-2',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
