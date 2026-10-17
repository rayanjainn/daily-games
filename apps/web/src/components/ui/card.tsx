import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Tile-style card: outlined, lifted, rounded. `interactive` adds hover lift + press. */
export const cardVariants = cva(
  'rounded-lg border-[length:var(--bw)] border-line bg-surface text-ink',
  {
    variants: {
      lift: {
        none: '',
        sm: 'shadow-lift-sm',
        md: 'shadow-lift-md',
        lg: 'shadow-lift-lg',
      },
      interactive: {
        true: [
          'cursor-pointer transition-[transform,box-shadow] duration-[var(--dur-fast)] ease-out',
          'hover:-translate-y-0.5 hover:shadow-lift-lg active:translate-y-[var(--lift-sm)] active:shadow-none',
        ],
      },
      tone: {
        default: '',
        muted: 'bg-surface-2',
      },
    },
    defaultVariants: { lift: 'md', tone: 'default' },
  },
);

export interface CardProps extends ComponentProps<'div'>, VariantProps<typeof cardVariants> {
  /** Render as a <section> (pair with aria-labelledby pointing at the card's heading). */
  asSection?: boolean;
}

export function Card({ className, lift, interactive, tone, asSection, ...props }: CardProps) {
  const Tag = asSection ? 'section' : 'div';
  return <Tag className={cn(cardVariants({ lift, interactive, tone }), className)} {...props} />;
}
