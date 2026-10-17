import { z } from 'zod';
import type { ScoringType, Tier } from '../domain';
import type { ParseGame, ParsedResult } from '../parsers/types';
import { currentPuzzle, dateForPuzzleNumber, latestAvailablePuzzleNumber } from '../time/puzzle';

/**
 * Manual entry (Tier 1 and 2 fallback) and the Tier 3 check-off. Both produce the same shape
 * as a parsed share, so saving, duplicate and future checks are shared with paste logging.
 */
export const manualEntrySchema = z
  .object({
    /** Defaults to today's puzzle for this player. */
    puzzleNumber: z.number().int().optional(),
    solved: z.boolean(),
    attempts: z.number().int().min(0).max(100).optional(),
    timeSeconds: z.number().int().min(0).max(86_399).optional(),
    score: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  .strict();

export type ManualEntry = z.infer<typeof manualEntrySchema>;

export interface EntryGame extends ParseGame {
  scoringType: ScoringType;
  tier: Tier;
}

export type EntryOutcome =
  | { ok: true; value: ParsedResult }
  | { ok: false; code: 'future_puzzle' | 'before_epoch' | 'invalid'; message: string };

const bad = (code: 'future_puzzle' | 'before_epoch' | 'invalid', message: string) => ({
  ok: false as const,
  code,
  message,
});

/** Checks the puzzle is real for this game and not released later than now. */
function resolvePuzzle(
  game: EntryGame,
  puzzleNumber: number | undefined,
  now: Date,
  userTz: string,
): { ok: true; number: number; date: string } | ReturnType<typeof bad> {
  const n = puzzleNumber ?? currentPuzzle(game.clock, now, userTz).number;
  if (n < game.clock.numbering.epochNumber)
    return bad('before_epoch', 'That puzzle is from before this game started.');
  if (n > latestAvailablePuzzleNumber(game.clock, now))
    return bad('future_puzzle', "That puzzle hasn't been released yet.");
  return { ok: true, number: n, date: dateForPuzzleNumber(game.clock, n) };
}

export function buildManualResult(
  game: EntryGame,
  entry: ManualEntry,
  now: Date,
  userTz: string,
): EntryOutcome {
  if (game.tier === 3) return bad('invalid', 'This game is tracked with a check-off, not a score.');
  const p = resolvePuzzle(game, entry.puzzleNumber, now, userTz);
  if (!p.ok) return p;

  const max = game.maxAttempts ?? undefined;
  switch (game.scoringType) {
    case 'attempts':
      if (entry.attempts === undefined) return bad('invalid', 'How many guesses did it take?');
      if (max && entry.attempts > max)
        return bad('invalid', `This game allows at most ${max} guesses.`);
      if (entry.solved && entry.attempts < 1)
        return bad('invalid', 'A solved puzzle takes at least one guess.');
      break;
    case 'time':
      if (entry.timeSeconds === undefined) return bad('invalid', 'How long did it take?');
      break;
    case 'points':
    case 'distance':
      if (entry.score === undefined) return bad('invalid', 'What was your score?');
      break;
    case 'completion':
      break;
  }

  return {
    ok: true,
    value: {
      puzzleNumber: p.number,
      puzzleDate: p.date,
      solved: entry.solved,
      attempts: entry.attempts,
      maxAttempts: game.scoringType === 'attempts' ? max : undefined,
      timeSeconds: entry.timeSeconds,
      score: entry.score,
      details: {},
      normalizedShareText: '',
    },
  };
}

/** Tier 3 "done today" (or for an earlier puzzle). */
export function buildCheckoff(
  game: EntryGame,
  puzzleNumber: number | undefined,
  now: Date,
  userTz: string,
): EntryOutcome {
  const p = resolvePuzzle(game, puzzleNumber, now, userTz);
  if (!p.ok) return p;
  return {
    ok: true,
    value: {
      puzzleNumber: p.number,
      puzzleDate: p.date,
      solved: true,
      details: {},
      normalizedShareText: '',
    },
  };
}
