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

/** Played days in a row that earn one streak freeze. */
export const FREEZE_EVERY = 7;
/** Freezes a player can hold at once. */
export const MAX_FREEZES = 2;

export interface FrozenStreak extends Streak {
  /** Freezes in the bank right now. */
  freezes: number;
  /** Played days until the next freeze is earned; null while the bank is full. */
  nextFreezeIn: number | null;
  /** Missed days a freeze covered inside the current streak (day indices). */
  frozenDays: number[];
}

/**
 * The combined daily streak with freezes. Every {@link FREEZE_EVERY} played days in a row earn a
 * freeze (at most {@link MAX_FREEZES} are held); a missed day uses one, so the streak carries on
 * (the frozen day itself doesn't count towards the length). With none banked, a missed day ends
 * the streak. Today never costs a freeze while it can still be played: the streak is "at risk"
 * until the day is over. Worked out from the played days alone, so it needs nothing stored.
 */
export function computeFrozenStreak(played: Iterable<number>, today: number): FrozenStreak {
  const days = new Set([...played].filter((d) => d <= today));
  if (days.size === 0)
    return {
      current: 0,
      best: 0,
      state: 'out',
      last: null,
      freezes: 0,
      nextFreezeIn: FREEZE_EVERY,
      frozenDays: [],
    };
  const first = Math.min(...days);
  const last = Math.max(...days);
  let run = 0;
  let best = 0;
  let freezes = 0;
  let frozen: number[] = [];
  for (let d = first; d <= today; d++) {
    if (days.has(d)) {
      run++;
      best = Math.max(best, run);
      if (run % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    } else if (d < today && run > 0) {
      if (freezes > 0) {
        freezes--;
        frozen.push(d);
      } else {
        run = 0;
        frozen = [];
      }
    }
  }
  const state: StreakState = days.has(today) ? 'active' : run > 0 ? 'at-risk' : 'out';
  return {
    current: run,
    best,
    state,
    last,
    freezes,
    nextFreezeIn: freezes >= MAX_FREEZES ? null : FREEZE_EVERY - (run % FREEZE_EVERY),
    frozenDays: frozen,
  };
}
