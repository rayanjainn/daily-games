'use client';

import { useEffect, useRef } from 'react';
import type { BadgeNews as News } from '@everydaily/shared/stats/badges';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';

/**
 * Announces newly reached badge levels once, then tells the server they've been seen. `quiet`
 * skips the toasts (the badges page shows what's new itself).
 */
export function BadgeNews({ news, quiet = false }: { news: News[]; quiet?: boolean }) {
  const toast = useToast();
  const done = useRef(false);
  useEffect(() => {
    if (!news.length || done.current) return;
    done.current = true;
    if (!quiet)
      for (const n of news)
        toast({
          tone: 'success',
          title: `New badge level: ${n.name}`,
          body: `${n.measure}: ${n.milestone.toLocaleString('en-US')}`,
        });
    api('/api/me/badges/seen', {}).catch(() => {});
  }, [news, quiet, toast]);
  return null;
}
