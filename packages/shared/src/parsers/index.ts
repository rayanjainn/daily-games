/**
 * Share-text parsing. Adding a parser = one file + one entry in PARSERS.
 */
import {
  currentPuzzle,
  dateForPuzzleNumber,
  latestAvailablePuzzleNumber,
  puzzleNumberForDate,
} from '../time/puzzle';
import { connections } from './connections';
import { generic } from './generic';
import { globle } from './globle';
import { minuteCryptic } from './minute-cryptic';
import { nytMini } from './nyt-mini';
import { octordle } from './octordle';
import { quordle } from './quordle';
import { strands } from './strands';
import { MAX_INPUT, normalizeInput } from './text';
import { fail, type ParseContext, type ParseOutcome, type Parser } from './types';
import { wordle } from './wordle';
import { worldle } from './worldle';

export * from './types';
export { normalizeInput } from './text';

export const PARSERS: Record<string, Parser> = Object.fromEntries(
  [
    wordle,
    connections,
    strands,
    nytMini,
    quordle,
    octordle,
    globle,
    worldle,
    minuteCryptic,
    generic,
  ].map((p) => [p.id, p]),
);

/** Parser ids whose `detect` matches the text (for routing a paste to the right game). */
export function detectParsers(raw: string): string[] {
  const text = normalizeInput(raw.slice(0, MAX_INPUT * 2));
  return Object.values(PARSERS)
    .filter((p) => p.detect(text))
    .map((p) => p.id);
}

/**
 * Parses share text for one game and applies the checks every game shares: input limits,
 * epoch, future puzzles, and number/date consistency.
 */
export function parseShareText(raw: string, parserId: string, ctx: ParseContext): ParseOutcome {
  const parser = PARSERS[parserId];
  if (!parser) return fail('not_this_game', `No parser called "${parserId}".`);
  if (raw.length > MAX_INPUT)
    return fail('too_long', `Share text is limited to ${MAX_INPUT} characters.`);
  const text = normalizeInput(raw);
  if (!text) return fail('empty', 'Paste the share text from the game.');

  const out = parser.extract(text, ctx);
  if (!out.ok) return out;
  const { clock } = ctx.game;
  const ex = out.value;

  let puzzleNumber: number;
  let puzzleDate: string;
  if (ex.by === 'today') {
    puzzleDate = ctx.forDate ?? currentPuzzle(clock, ctx.now, ctx.userTimeZone).date;
    puzzleNumber = puzzleNumberForDate(clock, puzzleDate);
  } else if (ex.by === 'date') {
    puzzleDate = ex.date;
    puzzleNumber = puzzleNumberForDate(clock, ex.date);
  } else {
    puzzleNumber = ex.number;
    puzzleDate = dateForPuzzleNumber(clock, ex.number);
    if (ex.date && ex.date !== puzzleDate) {
      return fail(
        'inconsistent',
        `Puzzle #${ex.number} is from ${puzzleDate}, but the share says ${ex.date}.`,
      );
    }
  }

  if (puzzleNumber < clock.numbering.epochNumber) {
    return fail('before_epoch', 'That puzzle is from before this game started.');
  }
  if (puzzleNumber > latestAvailablePuzzleNumber(clock, ctx.now)) {
    return fail('future_puzzle', "That puzzle hasn't been released yet.");
  }

  return { ok: true, value: { ...ex.partial, puzzleNumber, puzzleDate } };
}
