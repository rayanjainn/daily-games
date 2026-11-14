import type { Rng } from './rng';

/**
 * Glow: a 5×5 board of lights. Tapping a light flips it and its four neighbours; turn every
 * light off. Boards are made by tapping a solved board at random, so every one can be solved,
 * and par is the fewest taps that do it.
 */
export const GLOW_N = 5;
export const GLOW_MAX_TAPS = 30;
const CELLS = GLOW_N * GLOW_N;

export function tap(board: readonly boolean[], i: number): boolean[] {
  const b = [...board];
  const r = Math.floor(i / GLOW_N);
  const c = i % GLOW_N;
  for (const [y, x] of [
    [r, c],
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ] as const)
    if (y >= 0 && y < GLOW_N && x >= 0 && x < GLOW_N) b[y * GLOW_N + x] = !b[y * GLOW_N + x];
  return b;
}

export const isDark = (board: readonly boolean[]) => board.every((v) => !v);

/**
 * The fewest taps that clear a board, by "chasing the lights": choose the first row's taps, then
 * each light left on is cleared by the tap below it. Trying all 32 first rows finds every
 * solution of a 5×5 board.
 */
export function par(board: readonly boolean[]): number | null {
  return solveGlow(board)?.length ?? null;
}

/** One shortest list of taps that clears the board, or null if there is none. */
export function solveGlow(board: readonly boolean[]): number[] | null {
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << GLOW_N; mask++) {
    let b = [...board];
    const taps: number[] = [];
    for (let c = 0; c < GLOW_N; c++)
      if (mask & (1 << c)) {
        b = tap(b, c);
        taps.push(c);
      }
    for (let r = 1; r < GLOW_N; r++)
      for (let c = 0; c < GLOW_N; c++)
        if (b[(r - 1) * GLOW_N + c]) {
          b = tap(b, r * GLOW_N + c);
          taps.push(r * GLOW_N + c);
        }
    if (isDark(b) && (best === null || taps.length < best.length)) best = taps;
  }
  return best;
}

export interface GlowPuzzle {
  board: boolean[];
  par: number;
}

export function glowPuzzle(rng: Rng): GlowPuzzle {
  for (let attempt = 0; attempt < 50; attempt++) {
    let board = Array<boolean>(CELLS).fill(false);
    const taps = rng.shuffle([...Array(CELLS).keys()]).slice(0, 6 + rng.int(4));
    for (const i of taps) board = tap(board, i);
    const p = par(board);
    if (p !== null && p >= 5 && !isDark(board)) return { board, par: p };
  }
  // Unreachable in practice; a fixed board keeps the game playable regardless.
  const board = [0, 6, 12, 18, 24].reduce((b, i) => tap(b, i), Array<boolean>(CELLS).fill(false));
  return { board, par: par(board) ?? 5 };
}

/** Plays a list of taps on the day's board and says whether every light is off at the end. */
export function playGlow(p: GlowPuzzle, taps: readonly number[]): boolean {
  if (taps.length > GLOW_MAX_TAPS || taps.some((t) => !Number.isInteger(t) || t < 0 || t >= CELLS))
    return false;
  return isDark(taps.reduce((b, t) => tap(b, t), p.board));
}

export function glowShare(puzzleNumber: number, taps: number, parTaps: number): string {
  const diff = taps - parTaps;
  const tag = diff <= 0 ? 'on par' : `par +${diff}`;
  return `Glow ${puzzleNumber.toLocaleString('en-US')} ${taps} taps (${tag})\n${'💡'.repeat(Math.min(parTaps, 10))}`;
}
