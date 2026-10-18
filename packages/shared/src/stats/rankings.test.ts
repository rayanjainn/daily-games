import { describe, expect, it } from 'vitest';
import { rankPlayers, type RankingInput } from './rankings';

const r = (userId: string, extra: Partial<RankingInput> = {}): RankingInput => ({
  userId,
  name: userId,
  scoring: 'attempts',
  solved: true,
  attempts: 3,
  maxAttempts: 6,
  ...extra,
});

describe('rankPlayers', () => {
  it('adds points across games and ranks by them', () => {
    const out = rankPlayers([
      r('ann'),
      r('ann', { scoring: 'time', attempts: null, maxAttempts: null }),
      r('bob'),
      r('cy', { solved: false }),
    ]);
    expect(out.map((p) => [p.userId, p.rank])).toEqual([
      ['ann', 1],
      ['bob', 2],
      ['cy', 3],
    ]);
    expect(out[0]).toMatchObject({ points: 84 + 70, solved: 2, played: 2 });
    expect(out[2]).toMatchObject({ points: 0, solved: 0, played: 1 });
  });
  it('shares a rank on equal points and ignores catch-ups', () => {
    const out = rankPlayers([r('bob'), r('ann'), r('zed', { fromArchive: true })]);
    expect(out.map((p) => [p.userId, p.rank])).toEqual([
      ['ann', 1],
      ['bob', 1],
    ]);
  });
  it('is empty with nothing played', () => {
    expect(rankPlayers([])).toEqual([]);
  });
});
