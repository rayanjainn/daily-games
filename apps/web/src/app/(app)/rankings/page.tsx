import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { rankings, type RankingScope } from '@/server/rankings';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Rankings' };

const SCOPES: { id: RankingScope; label: string; note: string }[] = [
  {
    id: 'verified',
    label: 'Played here',
    note: 'Only results from EveryDaily’s own games, which the server watched being played. These can’t be typed in.',
  },
  {
    id: 'all',
    label: 'All games',
    note: 'Every logged result, including pasted and typed-in ones. Self-reported, so treat it as friendly fun.',
  },
];

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { user } = await requireSession();
  const scope: RankingScope = (await searchParams).scope === 'all' ? 'all' : 'verified';
  const { rows, players } = await rankings(user.id, scope);
  const current = SCOPES.find((s) => s.id === scope)!;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl sm:text-4xl">Rankings</h1>
        <p className="mt-1 text-ink-soft">Combined points over the last 7 days.</p>
      </div>
      <nav aria-label="Ranking type" className="flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <Link
            key={s.id}
            href={s.id === 'verified' ? '/rankings' : '/rankings?scope=all'}
            aria-current={s.id === scope ? 'page' : undefined}
            className={
              s.id === scope
                ? 'rounded-full border-[length:var(--bw)] border-line bg-pop px-4 py-1.5 font-display text-sm font-semibold text-on-pop'
                : 'rounded-full border-[length:var(--bw)] border-line-soft px-4 py-1.5 font-display text-sm font-semibold hover:bg-surface-2'
            }
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-ink-soft">{current.note}</p>
      <Card className="p-0">
        {rows.length ? (
          <ol className="divide-y-2 divide-line-soft" aria-label={`${current.label} rankings`}>
            {rows.map((r) => (
              <li
                key={r.userId}
                data-testid="ranking-row"
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="w-8 font-display text-lg font-bold tabular-nums">{r.rank}</span>
                <span className="min-w-0 flex-1 truncate font-display font-semibold">
                  {r.name} {r.me ? <Badge tone="mint">You</Badge> : null}
                </span>
                <span className="text-sm text-ink-soft">
                  {r.solved} solved · {r.played} played
                </span>
                <span className="w-20 text-right font-display font-bold tabular-nums">
                  {r.points} pts
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="p-6 text-center text-ink-soft" data-testid="rankings-empty">
            No results yet this week.
            {scope === 'verified' ? ' Play Cipher, Scramble or Make It to get on the board.' : ''}
          </p>
        )}
      </Card>
      {players > rows.length ? (
        <p className="text-center text-sm text-ink-soft">
          Showing the top of {players} players. You can hide yourself in Settings.
        </p>
      ) : null}
    </div>
  );
}
