import { describe, expect, it } from 'vitest';
import { headToHead, type H2HResult } from './head-to-head';

const r = (n: number, over: Partial<H2HResult> = {}): H2HResult => ({
  puzzleNumber: n,
  solved: true,
  attempts: null,
  maxAttempts: null,
  timeSeconds: null,
  score: null,
  ...over,
});

describe('headToHead', () => {
  it('counts wins on shared puzzles only, fewer guesses winning', () => {
    const h = headToHead(
      [r(1, { attempts: 3 }), r(2, { attempts: 5 }), r(3, { attempts: 4 }), r(4, { attempts: 2 })],
      [r(1, { attempts: 4 }), r(2, { attempts: 3 }), r(3, { attempts: 4 }), r(9, { attempts: 1 })],
      'attempts',
    );
    expect(h).toEqual({
      shared: 3,
      youWon: 1,
      theyWon: 1,
      tied: 1,
      you: { played: 4, solved: 4 },
      them: { played: 4, solved: 4 },
    });
  });

  it('a solve beats a miss, two misses tie', () => {
    const h = headToHead(
      [r(1, { solved: false }), r(2, { attempts: 6 }), r(3, { solved: false })],
      [r(1, { attempts: 2 }), r(2, { solved: false }), r(3, { solved: false })],
      'attempts',
    );
    expect(h).toMatchObject({ youWon: 1, theyWon: 1, tied: 1 });
  });

  it('uses each scoring direction', () => {
    expect(
      headToHead([r(1, { timeSeconds: 40 })], [r(1, { timeSeconds: 55 })], 'time').youWon,
    ).toBe(1);
    expect(headToHead([r(1, { score: 300 })], [r(1, { score: 500 })], 'points').theyWon).toBe(1);
    expect(headToHead([r(1, { score: 1 })], [r(1, { score: 3 })], 'distance').youWon).toBe(1);
    expect(headToHead([r(1)], [r(1)], 'completion').tied).toBe(1);
  });
});
