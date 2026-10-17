'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 rounded-md border-2 border-line bg-ink px-2.5 py-1.5 font-display text-xs font-semibold text-paper shadow-lift-sm data-[state=delayed-open]:animate-pop-in"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[var(--ink)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
