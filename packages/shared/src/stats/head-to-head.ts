import type { ScoringType } from '../domain';
import type { ResultLike } from './format';

export interface H2HResult extends ResultLike {
  puzzleNumber: number;
}

export interface H2HSide {
  played: number;
  solved: number;
}

export interface HeadToHead {
  /** Puzzles both players logged. */
  shared: number;
  youWon: number;
  theyWon: number;
  tied: number;
  you: H2HSide;
  them: H2HSide;
}

/** Comparable value of a result; null = unsolved. Lower or higher wins by scoring type. */
function value(r: ResultLike, t: ScoringType): number | null {
  if (!r.solved) return null;
  if (t === 'attempts') return r.attempts;
  if (t === 'time') return r.timeSeconds;
  if (t === 'points' || t === 'distance') return r.score;
  return 0;
}

/**
 * Compares two players on one game, puzzle by puzzle. Only puzzles both logged count as
 * meetings: a solve beats a miss, then the better score wins (fewer guesses, faster time, fewer
 * hints, more points); equal scores, two misses, and check-off games are ties.
 */
export function headToHead(
  mine: H2HResult[],
  theirs: H2HResult[],
  scoring: ScoringType,
): HeadToHead {
  const theirsBy = new Map(theirs.map((r) => [r.puzzleNumber, r]));
  const out: HeadToHead = {
    shared: 0,
    youWon: 0,
    theyWon: 0,
    tied: 0,
    you: { played: mine.length, solved: mine.filter((r) => r.solved).length },
    them: { played: theirs.length, solved: theirs.filter((r) => r.solved).length },
  };
  const lowerWins = scoring === 'attempts' || scoring === 'time' || scoring === 'distance';
  for (const a of mine) {
    const b = theirsBy.get(a.puzzleNumber);
    if (!b) continue;
    out.shared++;
    const va = value(a, scoring);
    const vb = value(b, scoring);
    if (va === null && vb === null) out.tied++;
    else if (vb === null) out.youWon++;
    else if (va === null) out.theyWon++;
    else if (va === vb) out.tied++;
    else if (va < vb === lowerWins) out.youWon++;
    else out.theyWon++;
  }
  return out;
}
