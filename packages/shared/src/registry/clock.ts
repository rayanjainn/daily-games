import type { Game } from '../db/schema';
import type { PuzzleClock } from '../time/puzzle';

/** Puzzle clock for a games row (DB shape). */
export function clockFromGame(
  g: Pick<
    Game,
    'resetMode' | 'resetTz' | 'resetHour' | 'resetGraceHours' | 'puzzleEpoch' | 'epochNumber'
  >,
): PuzzleClock {
  return {
    reset: {
      mode: g.resetMode,
      timezone: g.resetTz,
      hour: g.resetHour,
      graceHours: g.resetGraceHours,
    },
    numbering: { epoch: g.puzzleEpoch, epochNumber: g.epochNumber },
  };
}
