import { dateForPuzzleNumber, type PuzzleClock } from '../time/puzzle';

export interface ArchiveDay {
  puzzleNumber: number;
  puzzleDate: string;
  /** null = missed */
  logged: { solved: boolean; fromArchive: boolean } | null;
}

/** How far back the archive tracker looks. */
export const ARCHIVE_WINDOW = 14;

/**
 * The puzzles before today in the tracker window, newest first. Days before `startNumber`
 * (when the player started following or first logged the game) and before the game's first
 * puzzle are left out, so a new follower isn't shown a wall of "missed" days.
 */
export function archiveDays(
  clock: PuzzleClock,
  todayNumber: number,
  startNumber: number,
  logged: ReadonlyMap<number, { solved: boolean; fromArchive: boolean }>,
  window = ARCHIVE_WINDOW,
): ArchiveDay[] {
  const first = Math.max(startNumber, clock.numbering.epochNumber, todayNumber - window);
  const days: ArchiveDay[] = [];
  for (let n = todayNumber - 1; n >= first; n--) {
    days.push({
      puzzleNumber: n,
      puzzleDate: dateForPuzzleNumber(clock, n),
      logged: logged.get(n) ?? null,
    });
  }
  return days;
}
