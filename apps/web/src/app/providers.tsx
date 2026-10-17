'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/pwa/service-worker';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          <ServiceWorker />
          {children}
        </ToastProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
