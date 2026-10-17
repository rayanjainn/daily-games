import { CalendarDays, EyeOff, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import type { Board } from '@/server/boards';

/** Today's board for one game plus the week across every game (groups and friends). */
export function PlayerBoard({
  board,
  viewerId,
  hrefFor,
  emptyText,
}: {
  board: Board;
  viewerId: string;
  /** Link for picking another game's board. */
  hrefFor: (slug: string) => string;
  emptyText: string;
}) {
  return (
    <>
      <Card
        asSection
        className="flex flex-col gap-4 p-5 sm:p-6"
        aria-labelledby="today-board-heading"
      >
        <h2 id="today-board-heading" className="flex items-center gap-2 text-xl">
          <Trophy className="size-5 text-ink-soft" aria-hidden />
          Today
          {board.game ? (
            <span className="font-body text-base font-normal text-ink-soft">
              · {board.game.name} {board.game.puzzleLabel}
            </span>
          ) : null}
        </h2>
        {board.games.length > 1 ? (
          <nav aria-label="Choose a game" className="flex flex-wrap gap-2">
            {board.games.map((g) => (
              <Link
                key={g.slug}
                href={hrefFor(g.slug)}
                aria-current={board.game?.slug === g.slug ? 'page' : undefined}
                className={cn(
                  'rounded-pill border-[length:var(--bw)] border-line px-3 py-1 font-display text-sm font-semibold',
                  board.game?.slug === g.slug
                    ? 'bg-ink text-paper'
                    : 'bg-surface hover:bg-surface-2',
                )}
              >
                {g.name}
              </Link>
            ))}
          </nav>
        ) : null}
        {board.hidden ? (
          <p
            className="flex items-center gap-2 rounded-md bg-info-soft p-3 text-sm text-info"
            data-testid="board-hidden"
          >
            <EyeOff className="size-4 shrink-0" aria-hidden />
            Log today&apos;s {board.game?.name} to see everyone&apos;s scores.
          </p>
        ) : null}
        {board.game ? (
          <ol className="divide-y-2 divide-line-soft" data-testid="today-board">
            {board.today.map((e) => (
              <li
                key={e.userId}
                className={cn(
                  'flex items-center justify-between gap-3 py-2.5',
                  e.userId === viewerId && '-mx-2 rounded-md bg-surface-2 px-2',
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-6 text-right font-display font-bold text-ink-soft">
                    {e.rank ?? '–'}
                  </span>
                  <span className="truncate font-semibold">
                    {e.name}
                    {e.userId === viewerId ? ' (you)' : ''}
                  </span>
                </span>
                {e.hidden ? (
                  <Badge tone="info">Played</Badge>
                ) : e.summary ? (
                  <Badge tone={e.solved ? 'success' : 'danger'}>{e.summary}</Badge>
                ) : (
                  <span className="text-sm text-ink-soft">Not yet</span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No games played this week" className="py-6">
            {emptyText}
          </EmptyState>
        )}
      </Card>

      <Card asSection className="flex flex-col gap-3 p-5 sm:p-6" aria-labelledby="week-heading">
        <h2 id="week-heading" className="flex items-center gap-2 text-xl">
          <CalendarDays className="size-5 text-ink-soft" aria-hidden />
          This week
          <span className="font-body text-base font-normal text-ink-soft">· every game</span>
        </h2>
        <ol className="divide-y-2 divide-line-soft" data-testid="week-board">
          {board.week.map((r) => (
            <li key={r.userId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-6 text-right font-display font-bold text-ink-soft">
                  {r.rank}
                </span>
                <span className="truncate font-semibold">{r.name}</span>
              </span>
              <span className="text-sm">
                <strong>{r.solved}</strong> solved · {r.played} played
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
