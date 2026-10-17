import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const inputClass = cn(
  'h-12 w-full rounded-md border-[length:var(--bw)] border-line bg-surface px-4 text-md text-ink',
  'placeholder:text-ink-faint shadow-[inset_0_2px_0_0_var(--line-soft)]',
  'transition-[box-shadow,border-color] duration-[var(--dur-fast)]',
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:border-focus',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25',
  'disabled:cursor-not-allowed disabled:opacity-60',
);

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(inputClass, 'h-auto min-h-28 py-3 leading-relaxed', className)}
      {...props}
    />
  );
}

/**
 * Label + control + hint/error wiring. The render prop receives ids for aria attributes.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-display text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
