import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import type { GlobalBoardRow } from '@/server/native';

/** Today's best results in a native game, from everyone who played it here. */
export function GlobalBoard({
  rows,
  players,
}: {
  rows: GlobalBoardRow[];
  /** Everyone who finished today's puzzle, listed or not. */
  players: number;
}) {
  if (!rows.length)
    return (
      <EmptyState title="Nobody has finished today's puzzle yet" className="py-6">
        Be the first on the board.
      </EmptyState>
    );
  return (
    <div className="flex flex-col gap-3">
      <ol className="divide-y-2 divide-line-soft" data-testid="global-board">
        {rows.map((r) => (
          <li
            key={`${r.rank}-${r.name}`}
            className={cn(
              'flex items-center justify-between gap-3 py-2.5',
              r.me && '-mx-2 rounded-md bg-surface-2 px-2',
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-6 text-right font-display font-bold text-ink-soft">{r.rank}</span>
              <span className="truncate font-semibold">
                {r.name}
                {r.me ? ' (you)' : ''}
              </span>
            </span>
            <Badge tone="success">{r.summary}</Badge>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-soft">
        {players} {players === 1 ? 'player has' : 'players have'} finished today. Only results
        played here count, so scores can&apos;t be typed in.{' '}
        <Link href="/settings" className="font-semibold underline underline-offset-2">
          Hide yourself in Settings
        </Link>
        .
      </p>
    </div>
  );
}
