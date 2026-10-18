import type { ScoringType } from '../domain';
import { resultPoints } from './points';

export interface RankingInput {
  userId: string;
  name: string;
  scoring: ScoringType;
  solved: boolean;
  attempts: number | null;
  maxAttempts: number | null;
  fromArchive?: boolean;
}

export interface RankedPlayer {
  userId: string;
  name: string;
  rank: number;
  points: number;
  solved: number;
  played: number;
}

/**
 * Players ranked by combined points over a set of results. Ties on points share a rank; more
 * solved puzzles, then name, order the rest. Catch-ups are left out like in the daily score.
 */
export function rankPlayers(rows: RankingInput[]): RankedPlayer[] {
  const by = new Map<string, Omit<RankedPlayer, 'rank'>>();
  for (const r of rows) {
    if (r.fromArchive) continue;
    const p = by.get(r.userId) ?? {
      userId: r.userId,
      name: r.name,
      points: 0,
      solved: 0,
      played: 0,
    };
    p.points += resultPoints(r, r.scoring);
    p.played += 1;
    if (r.solved) p.solved += 1;
    by.set(r.userId, p);
  }
  const sorted = [...by.values()].sort(
    (a, b) => b.points - a.points || b.solved - a.solved || a.name.localeCompare(b.name),
  );
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((p, i) => {
    if (p.points !== prev) rank = i + 1;
    prev = p.points;
    return { ...p, rank };
  });
}
