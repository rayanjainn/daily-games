'use client';

import type { RoomState } from '@/lib/room-client';
import { cn } from '@/lib/cn';

const typingText = (names: string[]) =>
  names.length === 1
    ? `${names[0]} is typing…`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing…`
      : `${names.length} people are typing…`;

/** "Live · 3 here" plus who is typing. Says nothing when live updates are off. */
export function LiveBar({
  state,
  selfName,
  className,
}: {
  state: RoomState;
  selfName?: string;
  className?: string;
}) {
  if (state.status === 'offline') return null;
  const others = state.typing.filter((t) => t.name !== selfName).map((t) => t.name);
  const live = state.status === 'live';
  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', className)}
      data-testid="live-bar"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold" data-status={state.status}>
        <span className={cn('size-2 rounded-full', live ? 'bg-success' : 'bg-warn')} aria-hidden />
        {live ? 'Live' : state.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
      </span>
      {live && state.presence.length ? (
        <span className="text-ink-soft" title={state.presence.map((p) => p.name).join(', ')}>
          {state.presence.length} here
        </span>
      ) : null}
      <span aria-live="polite" className="text-ink-soft">
        {others.length ? typingText(others) : ''}
      </span>
    </div>
  );
}
