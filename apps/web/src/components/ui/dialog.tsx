'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Centered card on desktop, bottom sheet on phones (thumb-reachable).
 */
export function DialogContent({
  className,
  children,
  title,
  description,
  hideClose = false,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: ReactNode;
  description?: ReactNode;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] data-[state=open]:animate-[fade-in_var(--dur-fast)_ease-out]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto border-[length:var(--bw-thick)] border-line bg-surface p-5 text-ink shadow-overlay',
          'inset-x-0 bottom-0 rounded-t-xl pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          'data-[state=open]:animate-[sheet-up_var(--dur-base)_var(--ease-out)]',
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,30rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6',
          'sm:data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      >
        <div className="mx-auto -mt-1 h-1.5 w-12 rounded-pill bg-line-soft sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="font-display text-xl font-semibold">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-ink-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {hideClose ? null : (
            <DialogPrimitive.Close
              className="-m-1 rounded-md p-2 text-ink-soft hover:bg-surface-2 hover:text-ink"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          )}
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
