import { addDays } from '../time/zoned';

export type WeekTile = 'solved' | 'failed' | 'missed';

export interface WeekRowInput {
  name: string;
  accentColor: string;
  /** Results by puzzle date (YYYY-MM-DD). */
  results: { puzzleDate: string; solved: boolean }[];
}

export interface WeekPoster {
  /** Seven dates, oldest first, ending today. */
  days: string[];
  rows: { name: string; accentColor: string; tiles: WeekTile[] }[];
  played: number;
  solved: number;
  /** Days with at least one result. */
  activeDays: number;
}

/**
 * The week as a board: one row per game, one tile per day (solved, failed, or missed). A day
 * with several results for one game (catch-ups) counts as solved if any was.
 */
export function weekPoster(today: string, games: WeekRowInput[], maxRows = 8): WeekPoster {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const inWeek = new Set(days);
  let played = 0;
  let solved = 0;
  const active = new Set<string>();
  const rows = games.slice(0, maxRows).map((g) => {
    const byDay = new Map<string, boolean>();
    for (const r of g.results) {
      if (!inWeek.has(r.puzzleDate)) continue;
      byDay.set(r.puzzleDate, (byDay.get(r.puzzleDate) ?? false) || r.solved);
    }
    const tiles = days.map((d): WeekTile => {
      if (!byDay.has(d)) return 'missed';
      played++;
      active.add(d);
      if (byDay.get(d)) {
        solved++;
        return 'solved';
      }
      return 'failed';
    });
    return { name: g.name, accentColor: g.accentColor, tiles };
  });
  return { days, rows, played, solved, activeDays: active.size };
}
