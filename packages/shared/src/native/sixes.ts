import type { Rng } from './rng';

/**
 * Sixes: a 6×6 sudoku. Every row, column and 2×3 box holds 1 to 6 once. The puzzle always has
 * exactly one solution, which only the server knows.
 */
export const SIXES_N = 6;
const BOX_H = 2;
const BOX_W = 3;
export const SIXES_CHECKS = 3;
const MIN_GIVENS = 12;

export interface SixesPuzzle {
  /** 36 cells, row by row; 0 is empty. */
  givens: number[];
  /** Server side only. */
  solution: number[];
}

const at = (r: number, c: number) => r * SIXES_N + c;

/** A valid filled grid from the classic pattern, then shuffled within the rules. */
function solvedGrid(rng: Rng): number[] {
  const base = (r: number, c: number) =>
    ((BOX_W * (r % BOX_H) + Math.floor(r / BOX_H) + c) % SIXES_N) + 1;
  const digits = rng.shuffle([1, 2, 3, 4, 5, 6]);
  // Rows can move within their band of two, bands can swap; columns within their stack of
  // three, stacks can swap. All of these keep rows, columns and boxes valid.
  const bands = rng.shuffle([0, 1, 2]);
  const rows = bands.flatMap((b) => rng.shuffle([0, 1]).map((i) => b * BOX_H + i));
  const stacks = rng.shuffle([0, 1]);
  const cols = stacks.flatMap((s) => rng.shuffle([0, 1, 2]).map((i) => s * BOX_W + i));
  const grid: number[] = [];
  for (let r = 0; r < SIXES_N; r++)
    for (let c = 0; c < SIXES_N; c++) grid.push(digits[base(rows[r]!, cols[c]!) - 1]!);
  return grid;
}

/** Counts solutions, stopping at `limit`. Plain backtracking: 36 cells is quick. */
export function countSolutions(cells: readonly number[], limit = 2): number {
  const g = [...cells];
  const ok = (i: number, v: number) => {
    const r = Math.floor(i / SIXES_N);
    const c = i % SIXES_N;
    for (let k = 0; k < SIXES_N; k++) if (g[at(r, k)] === v || g[at(k, c)] === v) return false;
    const br = r - (r % BOX_H);
    const bc = c - (c % BOX_W);
    for (let y = br; y < br + BOX_H; y++)
      for (let x = bc; x < bc + BOX_W; x++) if (g[at(y, x)] === v) return false;
    return true;
  };
  let count = 0;
  const solve = (): void => {
    const i = g.indexOf(0);
    if (i < 0) {
      count++;
      return;
    }
    for (let v = 1; v <= SIXES_N && count < limit; v++) {
      if (!ok(i, v)) continue;
      g[i] = v;
      solve();
      g[i] = 0;
    }
  };
  solve();
  return count;
}

export function sixesPuzzle(rng: Rng): SixesPuzzle {
  const solution = solvedGrid(rng);
  const givens = [...solution];
  let left = givens.length;
  for (const i of rng.shuffle([...Array(SIXES_N * SIXES_N).keys()])) {
    if (left <= MIN_GIVENS) break;
    const keep = givens[i]!;
    givens[i] = 0;
    if (countSolutions(givens) !== 1) givens[i] = keep;
    else left--;
  }
  return { givens, solution };
}

export type SixesCheck =
  { ok: true } | { ok: false; reason: 'givens' | 'incomplete' | 'wrong'; wrongCells?: number };

/** Checks a full grid: the givens must be kept, every cell filled, and it must be the solution. */
export function checkSixes(p: SixesPuzzle, cells: readonly number[]): SixesCheck {
  if (cells.length !== SIXES_N * SIXES_N) return { ok: false, reason: 'incomplete' };
  if (p.givens.some((v, i) => v && cells[i] !== v)) return { ok: false, reason: 'givens' };
  if (cells.some((v) => !Number.isInteger(v) || v < 1 || v > SIXES_N))
    return { ok: false, reason: 'incomplete' };
  const wrong = cells.filter((v, i) => v !== p.solution[i]).length;
  return wrong ? { ok: false, reason: 'wrong', wrongCells: wrong } : { ok: true };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function sixesShare(puzzleNumber: number, seconds: number | null, checks: number): string {
  const head = `Sixes ${puzzleNumber.toLocaleString('en-US')} ${seconds === null ? 'X' : clock(seconds)}`;
  const marks = '🟥'.repeat(Math.max(0, checks - (seconds === null ? 0 : 1)));
  return `${head}\n${marks}${seconds === null ? '' : '🟩'}`;
}
