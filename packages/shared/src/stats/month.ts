import { addDays, parseIsoDate, toIsoDate } from '../time/zoned';
import { computeStreak, dayIndex } from './streak';

export interface MonthResult {
  gameId: string;
  puzzleDate: string;
  solved: boolean;
  fromArchive: boolean;
}

export interface MonthGame {
  id: string;
  name: string;
  accentColor: string;
}

export interface MonthRecap {
  /** YYYY-MM */
  month: string;
  /** Every date of the month, oldest first. */
  days: string[];
  /** Days counted so far: the whole month once it is over, up to today while it runs. */
  elapsed: number;
  /** Results per day (by puzzle date), aligned with `days`; null for days still to come. */
  perDay: (number | null)[];
  played: number;
  solved: number;
  activeDays: number;
  /** Longest run of days in a row with a result, inside the month (catch-ups don't count). */
  bestStreak: number;
  /** Most played games, most first. */
  top: (MonthGame & { played: number; solved: number })[];
  /** 0 = Monday … 6 = Sunday; null when nothing was played. */
  busiestWeekday: number | null;
}

/** YYYY-MM of an ISO date. */
export const monthOf = (date: string) => date.slice(0, 7);

/** The month before `month` (YYYY-MM). */
export function previousMonth(month: string): string {
  const { year, month: m } = parseIsoDate(`${month}-01`);
  return m === 1 ? `${year - 1}-12` : toIsoDate(year, m - 1, 1).slice(0, 7);
}

/** Monday-based weekday of an ISO date. */
export const weekdayOf = (date: string) => (dayIndex(date) + 3) % 7;

/**
 * A month in numbers, Wrapped-style. Results are grouped by puzzle date, so a catch-up counts
 * in the month its puzzle came out.
 */
export function monthRecap(
  month: string,
  today: string,
  results: MonthResult[],
  games: MonthGame[],
  topN = 3,
): MonthRecap {
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = first; monthOf(d) === month; d = addDays(d, 1)) days.push(d);
  const inMonth = results.filter((r) => monthOf(r.puzzleDate) === month && r.puzzleDate <= today);

  const counts = new Map<string, number>();
  for (const r of inMonth) counts.set(r.puzzleDate, (counts.get(r.puzzleDate) ?? 0) + 1);
  const perDay = days.map((d) => (d > today ? null : (counts.get(d) ?? 0)));

  const live = inMonth.filter((r) => !r.fromArchive).map((r) => dayIndex(r.puzzleDate));
  const bestStreak = live.length ? computeStreak(live, Math.max(...live)).best : 0;

  const byGame = new Map<string, { played: number; solved: number }>();
  for (const r of inMonth) {
    const g = byGame.get(r.gameId) ?? { played: 0, solved: 0 };
    g.played++;
    if (r.solved) g.solved++;
    byGame.set(r.gameId, g);
  }
  const top = games
    .filter((g) => byGame.has(g.id))
    .map((g) => ({ ...g, ...byGame.get(g.id)! }))
    .sort((a, b) => b.played - a.played || b.solved - a.solved || a.name.localeCompare(b.name))
    .slice(0, topN);

  const weekdays = Array<number>(7).fill(0);
  for (const r of inMonth) weekdays[weekdayOf(r.puzzleDate)]!++;
  const most = Math.max(...weekdays);

  return {
    month,
    days,
    elapsed: perDay.filter((n) => n !== null).length,
    perDay,
    played: inMonth.length,
    solved: inMonth.filter((r) => r.solved).length,
    activeDays: counts.size,
    bestStreak,
    top,
    busiestWeekday: most > 0 ? weekdays.indexOf(most) : null,
  };
}
