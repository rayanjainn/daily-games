import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill border-2 border-line px-2 py-0.5 font-display text-xs font-semibold leading-none [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-ink',
        pop: 'bg-pop text-on-pop',
        grape: 'bg-grape text-on-grape',
        mint: 'bg-mint text-on-mint',
        sun: 'bg-sun text-on-sun',
        sky: 'bg-sky text-on-sky',
        success: 'border-transparent bg-success-soft text-success',
        warn: 'border-transparent bg-warn-soft text-warn',
        danger: 'border-transparent bg-danger-soft text-danger',
        info: 'border-transparent bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
