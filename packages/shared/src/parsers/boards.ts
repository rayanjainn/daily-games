import { boardEmojiValue, graphemes } from './text';

/**
 * Reads multi-board scoreboard rows (Quordle, Octordle): each row is a pair of emoji whose value
 * is the guess on which that board was solved, or null when it was not solved.
 */
export function readBoardRows(lines: string[], perRow: number): (number | null)[][] | null {
  const rows: (number | null)[][] = [];
  for (const line of lines) {
    const gs = graphemes(line.replace(/\s+/g, ''));
    if (gs.length !== perRow) return null;
    const values = gs.map(boardEmojiValue);
    if (values.some((v) => v === undefined)) return null;
    rows.push(values as (number | null)[]);
  }
  return rows;
}

/** A guess can solve at most one board, so solved boards must have distinct guess numbers. */
export function distinctSolves(boards: (number | null)[]): boolean {
  const solved = boards.filter((b): b is number => b !== null);
  return new Set(solved).size === solved.length;
}
