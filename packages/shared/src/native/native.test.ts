import { describe, expect, it } from 'vitest';
import {
  CIPHER_MAX_GUESSES,
  cipherCode,
  cipherFeedback,
  cipherRow,
  cipherShare,
  isCipherGuess,
} from './cipher';
import { checkMakeIt, makeItPuzzle, makeItShare, solveMakeIt } from './make-it';
import { rngFromBytes, seedFromString } from './rng';
import {
  isScrambleSolution,
  scrambleCandidates,
  scramblePuzzle,
  scrambleShare,
  SCRAMBLE_WORDS,
} from './scramble';

const rng = (s: string) => rngFromBytes(seedFromString(s));

describe('rng', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = Array.from({ length: 6 }, () => rng('one').next());
    expect(new Set(a).size).toBe(1);
    const x = rng('one');
    const y = rng('two');
    expect([x.next(), x.next(), x.next()]).not.toEqual([y.next(), y.next(), y.next()]);
    expect(() => rngFromBytes(new Uint8Array(8))).toThrow();
  });

  it('keeps ints in range and shuffles without losing items', () => {
    const r = rng('range');
    for (let i = 0; i < 500; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(() => r.int(0)).toThrow();
  });

  it('spreads values roughly evenly', () => {
    const r = rng('even');
    const counts = Array<number>(6).fill(0);
    for (let i = 0; i < 6000; i++) counts[r.int(6)]!++;
    for (const c of counts) expect(c).toBeGreaterThan(800);
  });
});

describe('cipher', () => {
  it('builds a four-symbol code from the seed', () => {
    const code = cipherCode(rng('code'));
    expect(code).toHaveLength(4);
    expect(code.every((c) => c >= 0 && c < 6)).toBe(true);
    expect(cipherCode(rng('code'))).toEqual(code);
  });

  it('validates guesses', () => {
    expect(isCipherGuess([0, 1, 2, 5])).toBe(true);
    for (const bad of [[0, 1, 2], [0, 1, 2, 6], [0, 1, 2, -1], [0, 1, 2, 1.5], 'abcd', null])
      expect(isCipherGuess(bad)).toBe(false);
  });

  it('scores exact and misplaced symbols, counting repeats correctly', () => {
    expect(cipherFeedback([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, misplaced: 0 });
    expect(cipherFeedback([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, misplaced: 4 });
    expect(cipherFeedback([0, 1, 2, 3], [4, 4, 4, 4])).toEqual({ exact: 0, misplaced: 0 });
    // One 1 in the code: only one of the guessed 1s can score.
    expect(cipherFeedback([1, 0, 0, 0], [1, 1, 1, 1])).toEqual({ exact: 1, misplaced: 0 });
    expect(cipherFeedback([1, 0, 0, 0], [0, 1, 1, 1])).toEqual({ exact: 0, misplaced: 2 });
    expect(cipherFeedback([2, 2, 3, 3], [2, 3, 2, 3])).toEqual({ exact: 2, misplaced: 2 });
  });

  it('writes a share that shows scores and never the symbols', () => {
    expect(cipherRow({ exact: 1, misplaced: 2 })).toBe('🟩🟨🟨⬛');
    const text = cipherShare(18, 3, true, [
      { exact: 0, misplaced: 2 },
      { exact: 2, misplaced: 1 },
      { exact: 4, misplaced: 0 },
    ]);
    expect(text).toBe('Cipher 18 3/8\n\n🟨🟨⬛⬛\n🟩🟩🟨⬛\n🟩🟩🟩🟩');
    expect(cipherShare(18, 8, false, [])).toBe(`Cipher 18 X/${CIPHER_MAX_GUESSES}`);
  });
});

const WORDS = [
  'candle',
  'garden',
  'planet',
  'orange',
  'silver',
  'bridge',
  'market',
  'winter',
  'summer',
  'jungle',
  'rocket',
  'forest',
  'basket',
  'camera',
  'dragon',
  'hammer',
  'island',
  'kitten',
  'ladder',
  'mirror',
  'pencil',
  'rabbit',
  'saddle',
  'ticket',
  'valley',
  'window',
  'yellow',
  'zipper',
  'anchor',
  'butter',
];

describe('scramble', () => {
  it('picks five different words and shuffles each', () => {
    const p = scramblePuzzle(rng('words'), WORDS);
    expect(p.answers).toHaveLength(SCRAMBLE_WORDS);
    expect(new Set(p.answers).size).toBe(SCRAMBLE_WORDS);
    p.answers.forEach((w, i) => {
      expect(p.scrambled[i]).not.toBe(w);
      expect([...p.scrambled[i]!].sort().join('')).toBe([...w].sort().join(''));
    });
    expect(scramblePuzzle(rng('words'), WORDS)).toEqual(p);
  });

  it('only uses plain words of a playable length', () => {
    expect(
      scrambleCandidates(['abandon', 'able', 'a-b-c-d-e', 'Planet', 'bridge', 'astonish']),
    ).toEqual(['abandon', 'bridge']);
    expect(() => scramblePuzzle(rng('x'), ['bridge', 'planet'])).toThrow();
  });

  it('accepts any real anagram, and nothing else', () => {
    const words = new Set(['listen', 'silent', 'enlist', 'tinsel']);
    expect(isScrambleSolution('ltsien', 'silent', words)).toBe(true);
    expect(isScrambleSolution('ltsien', 'LISTEN', words)).toBe(true);
    expect(isScrambleSolution('ltsien', ' tinsel ', words)).toBe(true);
    expect(isScrambleSolution('ltsien', 'inlets', words)).toBe(false); // right letters, not in the list
    expect(isScrambleSolution('ltsien', 'listed', words)).toBe(false); // wrong letters
    expect(isScrambleSolution('ltsien', 'list', words)).toBe(false);
  });

  it('shares only the time', () => {
    expect(scrambleShare(18, 102)).toBe('Scramble 18 1:42\n🟩🟩🟩🟩🟩');
    expect(scrambleShare(1234, 9)).toBe('Scramble 1,234 0:09\n🟩🟩🟩🟩🟩');
  });
});

describe('make it', () => {
  const puzzle = { numbers: [3, 4, 6, 8], target: 24 };

  it('accepts a correct expression written several ways', () => {
    expect(checkMakeIt(puzzle, '(8-6)*4*3')).toEqual({ ok: true, value: 24 });
    expect(checkMakeIt(puzzle, '3 × (8 − 6) × 4')).toEqual({ ok: true, value: 24 });
    expect(checkMakeIt(puzzle, '4*6*(8-3)-96')).toMatchObject({ ok: false });
  });

  it('uses exact fractions, so answers that pass through a fraction work', () => {
    // 5 × (5 − 1/5) = 24
    expect(checkMakeIt({ numbers: [1, 5, 5, 5], target: 24 }, '5*(5-1/5)')).toEqual({
      ok: true,
      value: 24,
    });
    expect(checkMakeIt({ numbers: [1, 5, 5, 5], target: 24 }, '(5-1/5)*5')).toEqual({
      ok: true,
      value: 24,
    });
    // 8 / (3 − 8/3) = 24
    expect(checkMakeIt({ numbers: [3, 3, 8, 8], target: 24 }, '8/(3-8/3)')).toEqual({
      ok: true,
      value: 24,
    });
    expect(solveMakeIt([1, 3, 4, 6], 24)).not.toBeNull();
    expect(checkMakeIt({ numbers: [1, 3, 4, 6], target: 24 }, '6/(1-3/4)')).toEqual({
      ok: true,
      value: 24,
    });
  });

  it('refuses an extra or missing number, even when the total is right', () => {
    const p = { numbers: [1, 5, 5, 5], target: 24 };
    expect(checkMakeIt(p, '5*(5-1/5)*1')).toMatchObject({ ok: false, reason: 'numbers' });
    expect(checkMakeIt(p, '5*5-1')).toMatchObject({ ok: false, reason: 'numbers' });
    expect(checkMakeIt(puzzle, '3*8+(6-4)*0')).toMatchObject({ ok: false, reason: 'numbers' });
  });

  it('explains what is wrong', () => {
    expect(checkMakeIt(puzzle, '')).toMatchObject({ reason: 'syntax' });
    expect(checkMakeIt(puzzle, '3+')).toMatchObject({ reason: 'syntax' });
    expect(checkMakeIt(puzzle, '(3+4')).toMatchObject({
      reason: 'syntax',
      message: 'A bracket is not closed.',
    });
    expect(checkMakeIt(puzzle, '3+4)')).toMatchObject({
      reason: 'syntax',
      message: 'A bracket is not open.',
    });
    expect(checkMakeIt(puzzle, '-3+4+6+8')).toMatchObject({ reason: 'syntax' });
    expect(checkMakeIt(puzzle, '3/(4-4)+6+8')).toMatchObject({
      reason: 'syntax',
      message: 'That divides by zero.',
    });
    expect(checkMakeIt(puzzle, '3+4+6+8')).toMatchObject({
      reason: 'value',
      message: 'That makes 21, not 24.',
    });
    expect(checkMakeIt(puzzle, '3+4+6')).toMatchObject({ reason: 'numbers' });
    expect(checkMakeIt(puzzle, '3+4+6+8+8')).toMatchObject({ reason: 'numbers' });
    expect(checkMakeIt(puzzle, '3+4+6+eval(8)')).toMatchObject({ reason: 'syntax' });
    expect(checkMakeIt(puzzle, '3.5+4+6+8')).toMatchObject({ reason: 'syntax' });
    expect(checkMakeIt(puzzle, '1'.repeat(81))).toMatchObject({ reason: 'syntax' });
    expect(checkMakeIt(puzzle, '('.repeat(20) + '3' + ')'.repeat(20))).toMatchObject({
      reason: 'syntax',
    });
  });

  it('only counts a whole-number total', () => {
    const p = { numbers: [1, 2, 3, 5], target: 10 };
    expect(checkMakeIt(p, '(1+2)*3+5/5')).toMatchObject({ ok: false });
    expect(checkMakeIt(p, '5*(3-1)*2/2')).toMatchObject({ ok: false });
  });

  it('makes a solvable puzzle from a seed, and the same one each time', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const p = makeItPuzzle(rng(seed));
      expect(p.numbers).toHaveLength(4);
      expect(p.target).toBeGreaterThanOrEqual(10);
      expect(p.target).toBeLessThanOrEqual(60);
      const solution = solveMakeIt(p.numbers, p.target);
      expect(solution).not.toBeNull();
      expect(checkMakeIt(p, solution!)).toEqual({ ok: true, value: p.target });
      expect(makeItPuzzle(rng(seed))).toEqual(p);
    }
  });

  it('returns null when a target cannot be reached', () => {
    expect(solveMakeIt([1, 1, 1, 1], 100)).toBeNull();
  });

  it('shares only the time', () => {
    expect(makeItShare(18, 48)).toBe('Make It 18 0:48\n🟩🟩🟩🟩');
  });
});
