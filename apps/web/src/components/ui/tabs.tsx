'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border-[length:var(--bw)] border-line bg-surface-2 p-1',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-4 font-display text-sm font-semibold text-ink-soft',
        'transition-[background-color,color,box-shadow] duration-[var(--dur-fast)]',
        'hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink',
        'data-[state=active]:shadow-[0_0_0_2px_var(--line),0_3px_0_2px_var(--edge)]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 focus-visible:outline-none', className)}
      {...props}
    />
  );
}
