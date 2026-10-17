import { describe, expect, it } from 'vitest';
import { computeGameStats, type StatResult } from './summary';

const res = (n: number, over: Partial<StatResult> = {}): StatResult => ({
  puzzleNumber: n,
  puzzleDate: `2026-10-${String(n % 28 || 1).padStart(2, '0')}`,
  solved: true,
  attempts: null,
  maxAttempts: null,
  timeSeconds: null,
  score: null,
  ...over,
});

const attempts = { type: 'attempts' as const, maxAttempts: 6 };

describe('computeGameStats', () => {
  it('summarizes an attempts game with a guess distribution', () => {
    const results = [
      res(10, { attempts: 4 }),
      res(11, { attempts: 3 }),
      res(12, { solved: false }),
      res(13, { attempts: 4 }),
      res(14, { attempts: 2 }),
    ];
    const s = computeGameStats(results, attempts, 14);
    expect(s).toMatchObject({ played: 5, solved: 4, solveRate: 80, average: '3.3', best: '2' });
    expect(s.streak).toMatchObject({ current: 5, best: 5, state: 'active' });
    expect(s.winStreak).toEqual({ current: 2, best: 2 });
    expect(s.distribution.map((b) => [b.label, b.count, b.current])).toEqual([
      ['1', 0, false],
      ['2', 1, true],
      ['3', 1, false],
      ['4', 2, false],
      ['5', 0, false],
      ['6', 0, false],
      ['X', 1, false],
    ]);
  });

  it('ends win streaks on gaps and keeps one alive through yesterday', () => {
    const s = computeGameStats(
      [
        res(1, { attempts: 3 }),
        res(2, { attempts: 3 }),
        res(3, { attempts: 3 }),
        res(8, { attempts: 1 }),
        res(9, { attempts: 5 }),
      ],
      attempts,
      10,
    );
    expect(s.winStreak).toEqual({ current: 2, best: 3 });
    expect(s.streak).toMatchObject({ current: 2, state: 'at-risk' });
    expect(computeGameStats([res(1, { attempts: 3 })], attempts, 10).winStreak.current).toBe(0);
  });

  it('counts archive catch-ups in totals but never in streaks', () => {
    const s = computeGameStats(
      [
        res(7, { attempts: 3 }),
        res(8, { attempts: 4, fromArchive: true }),
        res(9, { attempts: 2 }),
        res(10, { attempts: 2 }),
      ],
      attempts,
      10,
    );
    expect(s).toMatchObject({ played: 4, solved: 4 });
    expect(s.streak).toMatchObject({ current: 2, best: 2 });
    expect(s.winStreak).toEqual({ current: 2, best: 2 });
  });

  it('uses lower-is-better for times and buckets them', () => {
    const results = [30, 42, 55, 61, 95].map((t, i) => res(i + 1, { timeSeconds: t }));
    const s = computeGameStats(results, { type: 'time' }, 5);
    expect(s.best).toBe('0:30');
    expect(s.average).toBe('0:57');
    expect(s.distribution.reduce((a, b) => a + b.count, 0)).toBe(5);
    expect(s.distribution.filter((b) => b.current)).toHaveLength(1);
  });

  it('uses higher-is-better for points', () => {
    const s = computeGameStats(
      [res(1, { score: 1200 }), res(2, { score: 900 })],
      { type: 'points', unit: 'pts' },
      2,
    );
    expect(s.best).toBe('1,200 pts');
  });

  it('only counts for check-off games', () => {
    const s = computeGameStats([res(1), res(2)], { type: 'completion' }, 2);
    expect(s).toMatchObject({ played: 2, distribution: [], average: null, best: null });
  });

  it('handles no results', () => {
    expect(computeGameStats([], attempts, 5)).toMatchObject({
      played: 0,
      solveRate: 0,
      average: null,
      best: null,
    });
  });
});
