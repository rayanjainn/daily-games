'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useRoom } from '@/lib/use-room';
import { LiveBar } from './live-bar';

/** Keeps a group's boards current: any member's new result refreshes the page data. */
export function LiveBoard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const pending = useRef<number | null>(null);
  const room = useRoom(`group:${groupId}`, () => {
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => router.refresh(), 250);
  });
  return <LiveBar state={room} />;
}
