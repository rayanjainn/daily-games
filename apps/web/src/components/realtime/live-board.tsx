'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useRoom } from '@/lib/use-room';
import { LiveBar } from './live-bar';

/**
 * Keeps a board current: any player's new result refreshes the page data. `room` is
 * `group:<id>` for a group, or `friends:<your id>` for your friends board.
 */
export function LiveBoard({ room: name }: { room: string }) {
  const router = useRouter();
  const pending = useRef<number | null>(null);
  const room = useRoom(name, () => {
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => router.refresh(), 250);
  });
  return <LiveBar state={room} />;
}
