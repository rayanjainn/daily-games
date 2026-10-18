import type { Rng } from './rng';
import { clock } from './scramble';

/** Make It: reach the target using each of the four numbers exactly once with + - × ÷ and brackets. */
export const MAKE_IT_NUMBERS = 4;
const MAX_EXPRESSION = 80;
const MAX_DEPTH = 12;

export interface MakeItPuzzle {
  numbers: number[];
  target: number;
}

// ---- exact arithmetic ------------------------------------------------------------------------

interface Frac {
  n: bigint;
  d: bigint;
}
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};
const frac = (n: bigint, d = 1n): Frac => {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
const key = (f: Frac) => `${f.n}/${f.d}`;
const show = (f: Frac) => (f.d === 1n ? String(f.n) : `${f.n}/${f.d}`);

// ---- checking a player's expression ----------------------------------------------------------

export type MakeItCheck =
  | { ok: true; value: number }
  | { ok: false; reason: 'syntax' | 'numbers' | 'value'; message: string };

type Parsed = { value: Frac; used: number[] };

/** Parses an expression with + - * / × ÷ − and brackets. Whole numbers only, no unary minus. */
function parse(src: string): Parsed | { error: string } {
  const text = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (!text) return { error: 'Type or tap an expression first.' };
  if (text.length > MAX_EXPRESSION) return { error: 'That expression is too long.' };
  if (!/^[0-9+\-*/()]+$/.test(text))
    return { error: 'Use only the numbers, + − × ÷ and brackets.' };
  let i = 0;
  const used: number[] = [];
  const fail = (m: string) => {
    throw new Error(m);
  };
  const expr = (depth: number): Frac => {
    if (depth > MAX_DEPTH) fail('Too many brackets inside each other.');
    let v = term(depth);
    while (text[i] === '+' || text[i] === '-') {
      const op = text[i++];
      const r = term(depth);
      v = op === '+' ? add(v, r) : sub(v, r);
    }
    return v;
  };
  const term = (depth: number): Frac => {
    let v = factor(depth);
    while (text[i] === '*' || text[i] === '/') {
      const op = text[i++];
      const r = factor(depth);
      if (op === '/' && r.n === 0n) fail('That divides by zero.');
      v = op === '*' ? mul(v, r) : div(v, r);
    }
    return v;
  };
  const factor = (depth: number): Frac => {
    const c = text[i];
    if (c === '(') {
      i++;
      const v = expr(depth + 1);
      if (text[i] !== ')') fail('A bracket is not closed.');
      i++;
      return v;
    }
    if (c !== undefined && c >= '0' && c <= '9') {
      let j = i;
      while (j < text.length && text[j]! >= '0' && text[j]! <= '9') j++;
      const digits = text.slice(i, j);
      i = j;
      const n = Number(digits);
      if (digits.length > 3) fail('That number is too big.');
      used.push(n);
      return frac(BigInt(n));
    }
    return fail('Put a number or a bracket there.');
  };
  try {
    const value = expr(0);
    if (i < text.length) fail(text[i] === ')' ? 'A bracket is not open.' : 'Check the expression.');
    return { value, used };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Checks an expression against a puzzle: valid syntax, each given number once, right total. */
export function checkMakeIt(puzzle: MakeItPuzzle, expression: string): MakeItCheck {
  const p = parse(expression);
  if ('error' in p) return { ok: false, reason: 'syntax', message: p.error };
  const want = [...puzzle.numbers].sort((a, b) => a - b);
  const got = [...p.used].sort((a, b) => a - b);
  if (want.join() !== got.join())
    return {
      ok: false,
      reason: 'numbers',
      message: `Use each of ${puzzle.numbers.join(', ')} exactly once.`,
    };
  if (p.value.d !== 1n || p.value.n !== BigInt(puzzle.target))
    return {
      ok: false,
      reason: 'value',
      message: `That makes ${show(p.value)}, not ${puzzle.target}.`,
    };
  return { ok: true, value: puzzle.target };
}

// ---- making puzzles --------------------------------------------------------------------------

type Reach = Map<string, { v: Frac; e: string }>;

/** Every value reachable from the numbers (each used once), with one expression for each. */
function reachable(numbers: readonly number[]): Reach {
  const n = numbers.length;
  const memo = new Map<number, Reach>();
  const solve = (mask: number): Reach => {
    const hit = memo.get(mask);
    if (hit) return hit;
    const out: Reach = new Map();
    const put = (v: Frac, e: string) => {
      if (!out.has(key(v))) out.set(key(v), { v, e });
    };
    if ((mask & (mask - 1)) === 0) {
      const idx = Math.log2(mask);
      put(frac(BigInt(numbers[idx]!)), String(numbers[idx]));
    } else {
      // Every way to split the numbers into two non-empty groups.
      for (let a = (mask - 1) & mask; a > 0; a = (a - 1) & mask) {
        const b = mask ^ a;
        if (a < b) continue;
        for (const x of solve(a).values())
          for (const y of solve(b).values()) {
            put(add(x.v, y.v), `(${x.e}+${y.e})`);
            put(mul(x.v, y.v), `(${x.e}*${y.e})`);
            put(sub(x.v, y.v), `(${x.e}-${y.e})`);
            put(sub(y.v, x.v), `(${y.e}-${x.e})`);
            if (y.v.n !== 0n) put(div(x.v, y.v), `(${x.e}/${y.e})`);
            if (x.v.n !== 0n) put(div(y.v, x.v), `(${y.e}/${x.e})`);
          }
      }
    }
    memo.set(mask, out);
    return out;
  };
  return solve((1 << n) - 1);
}

/** One expression that makes `target`, or null. Used by tests and to prove a puzzle is solvable. */
export function solveMakeIt(numbers: readonly number[], target: number): string | null {
  const hit = reachable(numbers).get(key(frac(BigInt(target))));
  if (!hit) return null;
  // Drop the outermost brackets.
  return hit.e.startsWith('(') && hit.e.endsWith(')') ? hit.e.slice(1, -1) : hit.e;
}

/** Four numbers and a target between 10 and 60 that really can be reached. */
export function makeItPuzzle(rng: Rng): MakeItPuzzle {
  for (let tries = 0; tries < 500; tries++) {
    const numbers = Array.from({ length: MAKE_IT_NUMBERS }, () => 1 + rng.int(9));
    if (new Set(numbers).size < 3) continue;
    const targets = [...reachable(numbers).values()]
      .filter(({ v }) => v.d === 1n && v.n >= 10n && v.n <= 60n)
      .map(({ v }) => Number(v.n))
      // A target that is just one number plus another (or a lone number) makes a dull puzzle.
      .filter((t) => !numbers.includes(t) && !numbers.some((a) => numbers.some((b) => a + b === t)))
      .sort((a, b) => a - b);
    if (targets.length >= 2)
      return { numbers: [...numbers].sort((a, b) => a - b), target: rng.pick(targets) };
  }
  // Unreachable with a sane generator; a fixed puzzle keeps the game playable regardless.
  return { numbers: [3, 4, 6, 8], target: 24 };
}

/** The text a player can share: only the time. */
export function makeItShare(puzzleNumber: number, seconds: number): string {
  return `Make It ${puzzleNumber.toLocaleString('en-US')} ${clock(seconds)}\n${'🟩'.repeat(MAKE_IT_NUMBERS)}`;
}
