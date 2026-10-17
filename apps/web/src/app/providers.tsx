'use client';

import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/pwa/service-worker';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <ToastProvider>
        <ServiceWorker />
        {children}
      </ToastProvider>
    </TooltipProvider>
  );
}
