/**
 * Puzzle numbering and reset math. Every game has a day index derived from its epoch:
 *   number = epochNumber + days(epoch, puzzleDate)
 * The puzzle date is decided by the game's reset rule:
 *   user_local  the player's own timezone (Wordle and most NYT games)
 *   fixed       one timezone for everyone (e.g. America/New_York)
 * `hour` shifts the reset: 3 = 03:00 on the puzzle's date, -2 = 22:00 the evening before.
 */
import {
  addDays,
  daysBetween,
  parseIsoDate,
  wallClock,
  zonedTimeToInstant,
  toIsoDate,
} from './zoned';

export interface ResetRule {
  mode: 'user_local' | 'fixed';
  /** Required for `fixed`. */
  timezone?: string | null;
  /** -12..23, default 0. */
  hour?: number;
  /** Hours a puzzle may appear before its nominal reset (e.g. weekend early release). */
  graceHours?: number;
}

export interface Numbering {
  epoch: string; // ISO date of puzzle `epochNumber`
  epochNumber: number;
}

export interface PuzzleClock {
  reset: ResetRule;
  numbering: Numbering;
}

/** Earliest timezone on Earth (UTC+14). Its date is the newest any player can see. */
export const EARLIEST_TZ = 'Pacific/Kiritimati';

function ruleTz(rule: ResetRule, userTz: string): string {
  if (rule.mode === 'fixed') {
    if (!rule.timezone) throw new Error('fixed reset rule needs a timezone');
    return rule.timezone;
  }
  return userTz;
}

/** The puzzle date in effect at `instant` for a player in `userTz`. */
export function puzzleDateAt(rule: ResetRule, instant: Date, userTz: string): string {
  const w = wallClock(instant, ruleTz(rule, userTz));
  // Shift the wall clock (not the instant) by the reset hour, so DST never moves the boundary.
  const shifted = new Date(
    Date.UTC(w.year, w.month - 1, w.day, w.hour - (rule.hour ?? 0), w.minute),
  );
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function puzzleNumberForDate(clock: PuzzleClock, date: string): number {
  return clock.numbering.epochNumber + daysBetween(clock.numbering.epoch, date);
}

export function dateForPuzzleNumber(clock: PuzzleClock, n: number): string {
  return addDays(clock.numbering.epoch, n - clock.numbering.epochNumber);
}

export function currentPuzzle(
  clock: PuzzleClock,
  now: Date,
  userTz: string,
): { number: number; date: string } {
  const date = puzzleDateAt(clock.reset, now, userTz);
  return { number: puzzleNumberForDate(clock, date), date };
}

/**
 * Highest puzzle number anyone could legitimately have played at `now`. Used to reject
 * future-dated results while still allowing travellers and earlier timezones.
 */
export function latestAvailablePuzzleNumber(clock: PuzzleClock, now: Date): number {
  const at = new Date(now.getTime() + (clock.reset.graceHours ?? 0) * 3_600_000);
  const tz = clock.reset.mode === 'fixed' ? clock.reset.timezone! : EARLIEST_TZ;
  return puzzleNumberForDate(clock, puzzleDateAt(clock.reset, at, tz));
}

/** The instant the puzzle for `date` becomes current under the rule. */
export function resetInstantForDate(rule: ResetRule, date: string, userTz: string): Date {
  const { year, month, day } = parseIsoDate(date);
  const hour = rule.hour ?? 0;
  const wall = new Date(Date.UTC(year, month - 1, day, hour, 0));
  return zonedTimeToInstant(
    {
      year: wall.getUTCFullYear(),
      month: wall.getUTCMonth() + 1,
      day: wall.getUTCDate(),
      hour: wall.getUTCHours(),
      minute: 0,
    },
    ruleTz(rule, userTz),
  );
}

/** When the next puzzle arrives for a player in `userTz`. */
export function nextResetAt(rule: ResetRule, now: Date, userTz: string): Date {
  return resetInstantForDate(rule, addDays(puzzleDateAt(rule, now, userTz), 1), userTz);
}
