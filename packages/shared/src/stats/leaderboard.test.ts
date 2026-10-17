import { describe, expect, it } from 'vitest';
import type { ResultLike } from './format';
import { rankDay, rankWeek } from './leaderboard';

const res = (over: Partial<ResultLike>): ResultLike => ({
  solved: true,
  attempts: null,
  maxAttempts: 6,
  timeSeconds: null,
  score: null,
  ...over,
});
const opts = { hideScores: false, viewerId: 'me' };

describe('rankDay', () => {
  it('ranks solves by score, shares ties, then misses, then players who have not played', () => {
    const board = rankDay(
      [
        { userId: 'a', name: 'ava', result: res({ attempts: 4 }) },
        { userId: 'b', name: 'ben', result: res({ attempts: 3 }) },
        { userId: 'c', name: 'cai', result: res({ attempts: 4 }) },
        { userId: 'd', name: 'dee', result: res({ solved: false, attempts: 6 }) },
        { userId: 'e', name: 'eve', result: null },
      ],
      'attempts',
      opts,
    );
    expect(board.map((e) => [e.name, e.rank, e.summary])).toEqual([
      ['ben', 1, '3/6'],
      ['ava', 2, '4/6'],
      ['cai', 2, '4/6'],
      ['dee', 4, 'X/6'],
      ['eve', null, null],
    ]);
  });

  it('puts the most points first', () => {
    const board = rankDay(
      [
        { userId: 'a', name: 'ava', result: res({ score: 300 }) },
        { userId: 'b', name: 'ben', result: res({ score: 650 }) },
      ],
      'points',
      opts,
    );
    expect(board.map((e) => e.name)).toEqual(['ben', 'ava']);
  });

  it('hides everyone else’s score and rank from a spoiler-safe viewer', () => {
    const board = rankDay(
      [
        { userId: 'me', name: 'me', result: null },
        { userId: 'a', name: 'ava', result: res({ attempts: 2 }) },
      ],
      'attempts',
      { hideScores: true, viewerId: 'me' },
    );
    expect(board[0]).toMatchObject({ name: 'ava', hidden: true, rank: null, summary: null });
    expect(board[1]).toMatchObject({ name: 'me', hidden: false, rank: null });
  });
});

describe('rankWeek', () => {
  it('orders by solves then games played, sharing ranks on ties', () => {
    expect(
      rankWeek([
        { userId: 'a', name: 'ava', played: 10, solved: 8 },
        { userId: 'b', name: 'ben', played: 12, solved: 8 },
        { userId: 'c', name: 'cai', played: 12, solved: 8 },
        { userId: 'd', name: 'dee', played: 3, solved: 3 },
      ]).map((r) => [r.name, r.rank]),
    ).toEqual([
      ['ben', 1],
      ['cai', 1],
      ['ava', 3],
      ['dee', 4],
    ]);
  });
});
