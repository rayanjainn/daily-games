import { ArrowLeft, EyeOff, Swords } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GameIcon } from '@/components/game/game-icon';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { compareWith, friendByUsername } from '@/server/friends';
import { requireSession } from '@/server/session';
import { BlockButton } from '../friends-view';
import type { IconKey } from '@everydaily/shared/registry/icons';

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `You vs ${(await params).username}` };
}

export default async function HeadToHeadPage({ params }: { params: Params }) {
  const { username } = await params;
  const { user } = await requireSession();
  const friend = await friendByUsername(user.id, username);
  if (!friend) notFound();
  const games = await compareWith(user, friend.id);
  const totals = games.reduce(
    (t, g) => ({
      you: t.you + g.h2h.youWon,
      them: t.them + g.h2h.theyWon,
      tied: t.tied + g.h2h.tied,
    }),
    { you: 0, them: 0, tied: 0 },
  );
  const name = friend.displayName ?? friend.username;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/friends"
        className="inline-flex w-fit items-center gap-1.5 rounded-md font-display text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Friends
      </Link>
      <Card className="flex flex-col gap-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl sm:text-4xl">
              <Swords className="size-8 text-pop" aria-hidden />
              You vs {name}
            </h1>
            <p className="mt-1 text-ink-soft">Puzzles you both played in the last 90 days.</p>
          </div>
          <BlockButton userId={friend.id} username={friend.username} />
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center" data-testid="h2h-totals">
          <Tally label="Your wins" value={totals.you} tone="text-success" />
          <Tally label="Ties" value={totals.tied} tone="text-ink-soft" />
          <Tally label={`${name}'s wins`} value={totals.them} tone="text-pop" />
        </dl>
      </Card>

      {games.length ? (
        <ul className="flex flex-col gap-3" data-testid="h2h-games">
          {games.map((g) => (
            <li key={g.game.slug}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <GameIcon icon={g.game.icon as IconKey} color={g.game.accentColor} size="sm" />
                  <div className="min-w-0">
                    <Link
                      href={`/games/${g.game.slug}`}
                      className="block truncate font-display text-lg font-semibold hover:underline"
                    >
                      {g.game.name}
                    </Link>
                    <p className="text-sm text-ink-soft">
                      {g.h2h.shared} shared · you {g.h2h.youWon} – {g.h2h.theyWon} {name}
                      {g.h2h.tied ? ` · ${g.h2h.tied} tied` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm" data-testid="h2h-today">
                  <span>
                    <span className="block text-xs text-ink-soft">You today</span>
                    <span className="font-display font-semibold">{g.today.mine ?? '—'}</span>
                  </span>
                  <span>
                    <span className="block text-xs text-ink-soft">{name} today</span>
                    {g.today.hidden ? (
                      <span className="inline-flex items-center gap-1 font-display font-semibold text-ink-soft">
                        <EyeOff className="size-3.5" aria-hidden /> Log yours to see
                      </span>
                    ) : (
                      <span className="font-display font-semibold">{g.today.theirs ?? '—'}</span>
                    )}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState title="Nothing to compare yet" className="py-8">
            Once you both log the same game, your results line up here.
          </EmptyState>
        </Card>
      )}
    </div>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className={`font-display text-3xl font-bold ${tone}`}>{value}</dd>
    </div>
  );
}
