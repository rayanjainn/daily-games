import type { ScoringType } from '../domain';

export interface PointsInput {
  solved: boolean;
  attempts: number | null;
  maxAttempts: number | null;
  /** Catch-ups don't score: the daily score is for the day's own puzzles. */
  fromArchive?: boolean;
}

/**
 * Points for one result, so very different games can be added up (the combined daily score).
 * A missed puzzle is 0. A solved one is worth 60 to 100 when the game counts guesses (the
 * fewer, the more), and 60 when guesses aren't known. Timed, point-based and check-off games
 * have no fair scale across games, so a solve is a flat 70; their real scores still rank
 * players within each game.
 */
export function resultPoints(r: PointsInput, scoring: ScoringType): number {
  if (!r.solved || r.fromArchive) return 0;
  if (scoring !== 'attempts') return 70;
  if (!r.attempts || !r.maxAttempts || r.maxAttempts < 2) return 60;
  const left = Math.min(Math.max(r.maxAttempts - r.attempts, 0), r.maxAttempts - 1);
  return Math.round(60 + (40 * left) / (r.maxAttempts - 1));
}

/** The combined score of a set of results. */
export function totalPoints(results: { result: PointsInput; scoring: ScoringType }[]): number {
  return results.reduce((sum, r) => sum + resultPoints(r.result, r.scoring), 0);
}
