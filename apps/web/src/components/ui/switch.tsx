'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-pill border-[length:var(--bw)] border-line p-0.5',
        'bg-surface-3 transition-colors duration-[var(--dur-fast)] data-[state=checked]:bg-mint',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-6 rounded-pill border-2 border-line bg-surface shadow-lift-sm',
          'transition-transform duration-[var(--dur-fast)] ease-[var(--ease-bounce)]',
          'data-[state=checked]:translate-x-6',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
