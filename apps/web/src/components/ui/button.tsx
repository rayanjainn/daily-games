import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Chunky game button: thick outline, solid "lift" edge underneath, presses down on click.
 */
export const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
    'font-display font-semibold tracking-tight',
    'border-[length:var(--bw-thick)] border-line',
    'transition-[transform,box-shadow,background-color,filter] duration-[var(--dur-instant)] ease-out',
    'hover:-translate-y-px hover:brightness-[1.04]',
    'active:translate-y-[var(--press)] active:shadow-none',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:size-[1.15em] [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-pop text-on-pop',
        secondary: 'bg-surface text-ink',
        grape: 'bg-grape text-on-grape',
        mint: 'bg-mint text-on-mint',
        sun: 'bg-sun text-on-sun',
        danger: 'bg-danger text-on-danger',
        ghost:
          'border-transparent bg-transparent text-ink shadow-none hover:bg-surface-2 hover:translate-y-0 active:translate-y-0',
      },
      size: {
        sm: 'h-10 rounded-md px-3.5 text-sm [--press:var(--lift-sm)] shadow-lift-sm',
        md: 'h-12 rounded-md px-5 text-md [--press:var(--lift-md)] shadow-lift-md',
        lg: 'h-14 rounded-lg px-7 text-lg [--press:var(--lift-md)] shadow-lift-md',
        icon: 'size-11 rounded-md p-0 [--press:var(--lift-sm)] shadow-lift-sm',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'ghost', class: 'shadow-none' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span className="sr-only">Loading</span>
        </>
      ) : null}
      {asChild ? children : loading ? <span aria-hidden>{children}</span> : children}
    </Comp>
  );
}
