'use client';

import { ArrowDown, ArrowUp, Check, ExternalLink, ListOrdered, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { confettiBurst } from '@/components/game/confetti';
import { FollowButton } from '@/components/game/follow-button';
import { GameIcon } from '@/components/game/game-icon';
import { ProgressRing } from '@/components/game/progress-ring';
import { StreakFlame } from '@/components/game/streak-flame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { CatalogGame } from '@/server/catalog';
import type { ChecklistItem, Dashboard } from '@/server/dashboard';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

function headline(done: number, total: number) {
  if (total === 0) return 'Pick your daily games to start a checklist.';
  if (done === total) return 'All done for today. See you tomorrow!';
  if (done === 0) return `${total} ${total === 1 ? 'puzzle' : 'puzzles'} waiting for you.`;
  const left = total - done;
  return `${left} more to go. Nice start!`;
}

/** Celebrates a completed checklist once per day per device. */
function useAllDoneConfetti(today: string, allDone: boolean) {
  const fired = useRef(false);
  useEffect(() => {
    if (!allDone || fired.current) return;
    fired.current = true;
    const key = `ed:confetti:${today}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      // Storage blocked: celebrate anyway, at most once per page view.
    }
    confettiBurst();
  }, [today, allDone]);
}

export function TodayView({
  name,
  dashboard,
  starters,
}: {
  name: string;
  dashboard: Dashboard;
  starters: CatalogGame[];
}) {
  const { items, done, combined, today } = dashboard;
  const total = items.length;
  useAllDoneConfetti(today, total > 0 && done === total);

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="min-w-0">
          <p
            className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft"
            data-testid="today-date"
          >
            {longDate(today)}
          </p>
          <h1 className="mt-1 break-words text-3xl sm:text-4xl">Hi, {name}</h1>
          <p className="mt-2 text-md" data-testid="today-headline">
            {headline(done, total)}
          </p>
        </div>
        <div className="flex items-center gap-5 self-center sm:self-auto">
          {total > 0 ? <ProgressRing value={done} max={total} size={112} /> : null}
          <div
            className="flex flex-col items-center gap-1 text-center"
            data-testid="combined-streak"
          >
            <StreakFlame
              count={combined.current}
              state={combined.state}
              size="lg"
              showCount={false}
            />
            <p className="font-display text-2xl font-bold leading-none tabular-nums">
              {combined.current}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              day streak
            </p>
          </div>
        </div>
      </Card>

      {combined.state === 'at-risk' && done === 0 && total > 0 ? (
        <p className="rounded-lg border-2 border-warn/30 bg-warn-soft p-3.5 text-sm font-semibold text-warn">
          Play any one puzzle today to keep your {combined.current}-day streak.
        </p>
      ) : null}

      {total ? <Checklist items={items} /> : <Starters games={starters} />}
    </div>
  );
}

function Checklist({ items: initial }: { items: ChecklistItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState(false);
  useEffect(() => setItems(initial), [initial]);

  async function move(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to]!, next[index]!];
    const before = items;
    setItems(next);
    try {
      await api('/api/follows/order', { gameIds: next.map((i) => i.game.id) }, 'PATCH');
    } catch (err) {
      setItems(before);
      toast({
        tone: 'error',
        title: err instanceof ApiError ? err.message : 'Could not save the order.',
      });
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="checklist-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="checklist-heading" className="whitespace-nowrap text-xl sm:text-2xl">
          Today&apos;s games
        </h2>
        <div className="flex gap-2">
          <Button
            variant={editing ? 'mint' : 'ghost'}
            size="sm"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
          >
            {editing ? <Check aria-hidden /> : <ListOrdered aria-hidden />}
            {editing ? 'Done' : 'Reorder'}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/games">
              <Plus aria-hidden />
              Add
            </Link>
          </Button>
        </div>
      </div>
      <ol className="flex flex-col gap-3" aria-label="Today's games">
        {items.map((item, i) => (
          <ChecklistRow
            key={item.game.id}
            item={item}
            editing={editing}
            first={i === 0}
            last={i === items.length - 1}
            onMove={(by) => move(i, by)}
          />
        ))}
      </ol>
    </section>
  );
}

function ChecklistRow({
  item,
  editing,
  first,
  last,
  onMove,
}: {
  item: ChecklistItem;
  editing: boolean;
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
}) {
  const { game, done, streak } = item;
  return (
    <li
      data-testid="checklist-item"
      data-done={done ? 'true' : 'false'}
      className={cn(
        'flex items-center gap-3 rounded-lg border-[length:var(--bw)] border-line p-3 shadow-lift-sm transition-colors sm:gap-4 sm:p-4',
        done ? 'bg-success-soft' : 'bg-surface',
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full border-[length:var(--bw)] border-line',
          done ? 'bg-mint text-on-mint' : 'bg-surface-2 text-transparent',
        )}
        aria-hidden
      >
        <Check className="size-5" strokeWidth={3} />
      </span>
      <GameIcon icon={game.icon} color={game.accentColor} size="sm" className="size-9 sm:size-10" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/games/${game.slug}`}
          className="block truncate font-display text-lg font-semibold leading-tight hover:underline"
        >
          {game.name}
        </Link>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
          <span data-testid="puzzle-label">
            {game.today.number !== null
              ? `#${game.today.number.toLocaleString('en-US')}`
              : "Today's puzzle"}
          </span>
          {streak.current > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <StreakFlame
                count={streak.current}
                state={streak.state}
                size="sm"
                showCount={false}
              />
              {streak.current}
            </span>
          ) : null}
        </p>
      </div>
      {editing ? (
        <div className="flex shrink-0 gap-1.5">
          <Button
            size="icon"
            variant="secondary"
            className="size-10"
            aria-label={`Move ${game.name} up`}
            disabled={first}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="size-10"
            aria-label={`Move ${game.name} down`}
            disabled={last}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden />
          </Button>
        </div>
      ) : done ? (
        <Badge tone="success" className="shrink-0 px-2.5 py-1 text-sm">
          <span className="sr-only">Done: </span>
          {done.summary}
        </Badge>
      ) : (
        <Button asChild size="sm" className="shrink-0">
          <a href={game.url} target="_blank" rel="noopener noreferrer">
            Play
            <ExternalLink aria-hidden />
            <span className="sr-only"> {game.name} (opens in a new tab)</span>
          </a>
        </Button>
      )}
    </li>
  );
}

function Starters({ games }: { games: CatalogGame[] }) {
  return (
    <div className="flex flex-col gap-5">
      <EmptyState
        title="Build your daily lineup"
        level={2}
        action={
          <Button asChild variant="secondary">
            <Link href="/games">Browse all games</Link>
          </Button>
        }
      >
        Follow the puzzles you play every day. They line up here as a checklist, and each one you
        finish keeps your streak going.
      </EmptyState>
      {games.length ? (
        <section aria-labelledby="picks-heading" className="flex flex-col gap-3">
          <h2 id="picks-heading" className="text-xl">
            Popular picks
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {games.map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-3 rounded-lg border-[length:var(--bw)] border-line bg-surface p-3 shadow-lift-sm"
              >
                <GameIcon icon={g.icon} color={g.accentColor} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-semibold">{g.name}</span>
                  <span className="block truncate text-sm text-ink-soft">{g.publisher}</span>
                </span>
                <FollowButton gameId={g.id} gameName={g.name} following={false} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
