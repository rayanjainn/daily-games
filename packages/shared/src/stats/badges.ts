import { computeStreak, dayIndex } from './streak';

/** Everything badges are worked out from: the player's own results, nothing stored. */
export interface BadgeResult {
  gameId: string;
  puzzleNumber: number;
  puzzleDate: string;
  solved: boolean;
  fromArchive: boolean;
}

export type BadgeId =
  'logged' | 'solved' | 'daily-streak' | 'game-streak' | 'explorer' | 'catch-up';

export interface Badge {
  id: BadgeId;
  name: string;
  /** What counts, e.g. "Puzzles logged". */
  measure: string;
  value: number;
  /** Milestones in order; a level is earned once `value` reaches it. */
  levels: number[];
  earned: number;
  /** The next milestone, or null once every level is earned. */
  next: number | null;
}

const FAMILIES: { id: BadgeId; name: string; measure: string; levels: number[] }[] = [
  { id: 'logged', name: 'Regular', measure: 'Puzzles logged', levels: [1, 10, 50, 250, 1000] },
  { id: 'solved', name: 'Solver', measure: 'Puzzles solved', levels: [10, 100, 500, 2000] },
  {
    id: 'daily-streak',
    name: 'Every day',
    measure: 'Longest daily streak',
    levels: [3, 7, 30, 100, 365],
  },
  {
    id: 'game-streak',
    name: 'Devoted',
    measure: 'Longest streak in one game',
    levels: [7, 30, 100, 365],
  },
  { id: 'explorer', name: 'Explorer', measure: 'Different games played', levels: [3, 10, 25] },
  {
    id: 'catch-up',
    name: 'Catching up',
    measure: 'Archive puzzles caught up',
    levels: [1, 10, 50],
  },
];

/**
 * Badge levels from a player's results. Streaks follow the dashboard's rules: catch-ups count
 * as played and solved but never towards a streak.
 */
export function computeBadges(results: BadgeResult[]): Badge[] {
  const live = results.filter((r) => !r.fromArchive);
  const byGame = new Map<string, number[]>();
  for (const r of live) byGame.set(r.gameId, [...(byGame.get(r.gameId) ?? []), r.puzzleNumber]);
  const days = live.map((r) => dayIndex(r.puzzleDate));
  const values: Record<BadgeId, number> = {
    logged: results.length,
    solved: results.filter((r) => r.solved).length,
    // `best` doesn't depend on "today", so the latest day stands in for it.
    'daily-streak': days.length ? computeStreak(days, Math.max(...days)).best : 0,
    'game-streak': Math.max(
      0,
      ...[...byGame.values()].map((n) => computeStreak(n, Math.max(...n)).best),
    ),
    explorer: new Set(results.map((r) => r.gameId)).size,
    'catch-up': results.length - live.length,
  };
  return FAMILIES.map((f) => {
    const value = values[f.id];
    const earned = f.levels.filter((l) => value >= l).length;
    return { ...f, value, earned, next: f.levels[earned] ?? null };
  });
}
