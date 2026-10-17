import type { HeatDay } from '@everydaily/shared/stats/heatmap';
import type { GameStats } from '@everydaily/shared/stats/summary';
import { StreakFlame } from '@/components/game/streak-flame';
import { cn } from '@/lib/cn';
import type { HistoryRow } from '@/server/stats';

function Tile({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface-2 p-3" data-testid={testId}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="font-display text-2xl font-bold leading-none tabular-nums">{value}</dd>
    </div>
  );
}

/** Headline numbers: streaks, games played, solve rate, average and best. */
export function StatTiles({ stats, completion }: { stats: GameStats; completion: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <StreakFlame
          count={stats.streak.current}
          state={stats.streak.state}
          size="lg"
          showCount={false}
        />
        <div>
          <p
            className="font-display text-4xl font-bold leading-none tabular-nums"
            data-testid="stat-streak"
          >
            {stats.streak.current}
          </p>
          <p className="text-sm text-ink-soft">day streak · best {stats.streak.best}</p>
        </div>
      </div>
      <dl className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Played" value={String(stats.played)} testId="stat-played" />
        {completion ? null : (
          <Tile label="Solved" value={`${stats.solveRate}%`} testId="stat-solve-rate" />
        )}
        {stats.average ? (
          <Tile label="Average" value={stats.average} testId="stat-average" />
        ) : null}
        {stats.best ? <Tile label="Best" value={stats.best} testId="stat-best" /> : null}
        {completion ? null : (
          <Tile label="Win streak" value={`${stats.winStreak.current}`} testId="stat-win-streak" />
        )}
      </dl>
    </div>
  );
}

/**
 * Horizontal bars like the games' own stats screens. A list, not a chart image, so screen
 * readers get each bucket and its count.
 */
export function Distribution({ bars, title }: { bars: GameStats['distribution']; title: string }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const wideLabels = bars.some((b) => b.label.length > 2);
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="font-display font-semibold">{title}</figcaption>
      <ol className="flex flex-col gap-1.5" data-testid="distribution">
        {bars.map((b) => (
          <li key={b.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'shrink-0 text-right font-semibold tabular-nums text-ink-soft',
                wideLabels ? 'w-24' : 'w-6',
              )}
            >
              {b.label}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'flex h-7 min-w-8 items-center justify-end rounded-md border-2 border-line px-2 font-display font-bold tabular-nums',
                  b.current ? 'bg-mint text-on-mint' : 'bg-surface-3 text-ink',
                )}
                style={{ width: `${Math.max(8, (b.count / max) * 100)}%` }}
              >
                <span aria-hidden>{b.count}</span>
                <span className="sr-only">
                  {b.count} {b.current ? '(today)' : ''}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

const HEAT: Record<HeatDay['state'], string> = {
  solved: 'bg-mint border-line',
  failed: 'bg-pop border-line',
  none: 'bg-surface-3 border-line-soft',
  future: 'bg-transparent border-transparent',
};
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** Last 26 weeks, one square per day. Scrolls sideways on narrow screens, newest in view. */
export function Heatmap({ weeks }: { weeks: HeatDay[][] }) {
  const played = weeks.flat().filter((d) => d.state === 'solved' || d.state === 'failed').length;
  const label = (d: HeatDay) =>
    `${new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}: ${
      d.state === 'solved' ? 'solved' : d.state === 'failed' ? 'not solved' : 'not played'
    }`;
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-display font-semibold">Last 6 months</span>
        <span className="text-sm text-ink-soft">{played} days played</span>
      </figcaption>
      <div className="flex min-w-0 gap-2" data-testid="heatmap">
        <div className="grid grid-rows-7 gap-1 text-[0.625rem] leading-3 text-ink-soft" aria-hidden>
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="h-3">
              {w}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-row-reverse overflow-x-auto pb-1">
          <div
            className="grid grid-flow-col grid-rows-7 gap-1"
            role="list"
            aria-label="Days played"
          >
            {weeks.flat().map((d) => (
              <span
                key={d.date}
                role={d.state === 'future' ? undefined : 'listitem'}
                aria-label={d.state === 'future' ? undefined : label(d)}
                title={d.state === 'future' ? undefined : label(d)}
                data-state={d.state}
                className={cn('size-3 rounded-[3px] border', HEAT[d.state])}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-soft" aria-hidden>
        <span className="inline-flex items-center gap-1">
          <span className={cn('size-3 rounded-[3px] border', HEAT.solved)} /> Solved
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn('size-3 rounded-[3px] border', HEAT.failed)} /> Not solved
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn('size-3 rounded-[3px] border', HEAT.none)} /> Not played
        </span>
      </div>
    </figure>
  );
}

const SOURCE: Record<string, string> = {
  paste: 'Pasted',
  manual: 'Entered',
  checkbox: 'Checked off',
  native: 'Played here',
  extension: 'Extension',
};

export function History({ rows }: { rows: HistoryRow[] }) {
  return (
    <ol className="divide-y-2 divide-line-soft" data-testid="history">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span>
            <span className="font-semibold">
              {r.puzzleNumber !== null ? `#${r.puzzleNumber.toLocaleString('en-US')}` : null}
            </span>{' '}
            <span className="text-ink-soft">
              {new Date(`${r.puzzleDate}T12:00:00Z`).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-ink-soft">
              {r.fromArchive ? 'Archive · ' : ''}
              {SOURCE[r.source] ?? r.source}
            </span>
            <span
              className={cn(
                'rounded-pill px-2 py-0.5 font-display text-sm font-semibold',
                r.solved ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
              )}
            >
              {r.summary}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
