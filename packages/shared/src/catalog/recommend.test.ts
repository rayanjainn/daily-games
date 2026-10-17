import { describe, expect, it } from 'vitest';
import { recommend, type Candidate } from './recommend';

const c = (id: string, extra: Partial<Candidate> = {}): Candidate => ({
  id,
  name: id,
  category: 'word',
  followers: 0,
  friendFollowers: 0,
  ...extra,
});

describe('recommend', () => {
  it('ranks friends first, then liked categories, then popularity', () => {
    const picks = recommend(
      [
        c('popular-trivia', { category: 'trivia', followers: 200 }),
        c('word-game', { category: 'word', followers: 3 }),
        c('friends-map', { category: 'geography', followers: 1, friendFollowers: 2 }),
        c('quiet-logic', { category: 'logic' }),
      ],
      ['word', 'word'],
      3,
    );
    expect(picks).toEqual([
      { id: 'friends-map', reason: { kind: 'friends', count: 2 } },
      { id: 'word-game', reason: { kind: 'category', category: 'word' } },
      { id: 'popular-trivia', reason: { kind: 'popular' } },
    ]);
  });

  it('caps the category boost so one big habit does not drown out everything', () => {
    const picks = recommend(
      [
        c('word-2', { category: 'word' }),
        c('big-trivia', { category: 'trivia', followers: 100_000 }),
      ],
      Array(10).fill('word'),
      1,
    );
    // 3 × 2 = 6 for the category, against log2(100001) / 2 ≈ 8.3 for popularity.
    expect(picks[0]!.id).toBe('big-trivia');
  });

  it('breaks ties by name and returns nothing without candidates', () => {
    expect(recommend([c('b'), c('a')], []).map((p) => p.id)).toEqual(['a', 'b']);
    expect(recommend([], ['word'])).toEqual([]);
  });
});
