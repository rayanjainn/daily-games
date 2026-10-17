import type { PuzzleClock } from '../time/puzzle';

export interface ParseGame {
  slug: string;
  tier: 1 | 2 | 3;
  clock: PuzzleClock;
  /** false: the game shows no number; results are keyed by date. */
  numberingPublic: boolean;
  maxAttempts?: number | null;
}

export interface ParseContext {
  game: ParseGame;
  now: Date;
  userTimeZone: string;
  /** Tier 2 only: the date a result is for (archive entries). Defaults to today. */
  forDate?: string;
}

export interface ParsedResult {
  puzzleNumber: number;
  puzzleDate: string;
  solved: boolean;
  attempts?: number;
  maxAttempts?: number;
  timeSeconds?: number;
  /** Game-specific score (mistakes, hints, points…); see the game's scoring type. */
  score?: number;
  details: Record<string, unknown>;
  /** Share text with spoilers and third-party content removed; safe to show to others. */
  normalizedShareText: string;
}

export type ParseErrorCode =
  | 'empty'
  | 'too_long'
  | 'not_this_game'
  | 'malformed'
  | 'inconsistent'
  | 'future_puzzle'
  | 'before_epoch';

export type ParseOutcome =
  { ok: true; value: ParsedResult } | { ok: false; code: ParseErrorCode; message: string };

/** What a parser extracts before the shared checks (epoch, future, dates) run. */
export type Extracted =
  | {
      by: 'number';
      number: number;
      partial: Omit<ParsedResult, 'puzzleNumber' | 'puzzleDate'>;
      date?: string;
    }
  | { by: 'date'; date: string; partial: Omit<ParsedResult, 'puzzleNumber' | 'puzzleDate'> }
  | { by: 'today'; partial: Omit<ParsedResult, 'puzzleNumber' | 'puzzleDate'> };

export type ExtractOutcome =
  { ok: true; value: Extracted } | { ok: false; code: ParseErrorCode; message: string };

export interface Parser {
  id: string;
  /** Cheap header check used to route pasted text to a game. */
  detect(text: string): boolean;
  extract(text: string, ctx: ParseContext): ExtractOutcome;
}

export const fail = (code: ParseErrorCode, message: string) => ({
  ok: false as const,
  code,
  message,
});
