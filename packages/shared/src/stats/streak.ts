/**
 * Streaks over day indices (puzzle numbers for one game, or day numbers for the combined
 * streak). A streak counts days played in a row, solved or not: it tracks the habit, the way the
 * dashboard checklist does. Win streaks are a separate stat.
 *
 *  active   today is done; `current` includes today
 *  at-risk  yesterday is done, today is not yet; `current` is still alive until the next reset
 *  out      the last played day is older than yesterday; `current` is 0
 */
export type StreakState = 'active' | 'at-risk' | 'out';

export interface Streak {
  current: number;
  best: number;
  state: StreakState;
  /** last played index, or null when nothing was played */
  last: number | null;
}

export function computeStreak(played: Iterable<number>, today: number): Streak {
  // Ignore anything after today (results are validated, but be safe with clock skew).
  const days = [...new Set(played)].filter((d) => d <= today).sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, best: 0, state: 'out', last: null };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1]! + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  const last = days[days.length - 1]!;
  // `run` is now the length of the run ending at `last`.
  if (last === today) return { current: run, best, state: 'active', last };
  if (last === today - 1) return { current: run, best, state: 'at-risk', last };
  return { current: 0, best, state: 'out', last };
}

/** Days since 1970-01-01 for an ISO date, to turn dates into streak indices. */
export function dayIndex(isoDate: string): number {
  return Math.round(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
}
