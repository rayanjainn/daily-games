import { describe, expect, it } from 'vitest';
import { addDays } from '../time/zoned';
import { computeBadges, levelsOf, newBadgeLevels, type BadgeResult } from './badges';

const day = (i: number) => addDays('2026-01-01', i);
const r = (gameId: string, i: number, extra: Partial<BadgeResult> = {}): BadgeResult => ({
  gameId,
  puzzleNumber: 100 + i,
  puzzleDate: day(i),
  solved: true,
  fromArchive: false,
  ...extra,
});
const byId = (list: ReturnType<typeof computeBadges>) =>
  Object.fromEntries(list.map((b) => [b.id, b]));

describe('computeBadges', () => {
  it('starts with nothing earned and the first milestone next', () => {
    const b = byId(computeBadges([]));
    expect(b.logged).toMatchObject({ value: 0, earned: 0, next: 1 });
    expect(b['daily-streak']).toMatchObject({ value: 0, earned: 0, next: 3 });
    expect(b['game-streak']!.value).toBe(0);
  });

  it('counts logged, solved, games and streaks', () => {
    const results = [
      ...Array.from({ length: 8 }, (_, i) => r('wordle', i)),
      r('mini', 0, { solved: false }),
      r('mini', 1),
      r('globle', 5),
    ];
    const b = byId(computeBadges(results));
    expect(b.logged).toMatchObject({ value: 11, earned: 2, next: 50 });
    expect(b.solved).toMatchObject({ value: 10, earned: 1, next: 100 });
    expect(b['daily-streak']).toMatchObject({ value: 8, earned: 2, next: 30 });
    expect(b['game-streak']).toMatchObject({ value: 8, earned: 1, next: 30 });
    expect(b.explorer).toMatchObject({ value: 3, earned: 1, next: 10 });
  });

  it('a gap breaks the daily streak; the longest run is kept', () => {
    const results = [0, 1, 2, 3, 5, 6].map((i) => r('wordle', i));
    expect(byId(computeBadges(results))['daily-streak']!.value).toBe(4);
  });

  it('the daily streak is carried over a missed day by a streak freeze', () => {
    // Seven days earn a freeze, day 7 is missed and covered, then three more days.
    const results = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10].map((i) => r('wordle', i));
    const b = byId(computeBadges(results));
    expect(b['daily-streak']!.value).toBe(10);
    // A single game's streak has no freezes.
    expect(b['game-streak']!.value).toBe(7);
  });

  it('catch-ups count as logged but never towards streaks', () => {
    const results = [r('wordle', 0), r('wordle', 1, { fromArchive: true }), r('wordle', 2)];
    const b = byId(computeBadges(results));
    expect(b.logged!.value).toBe(3);
    expect(b['catch-up']).toMatchObject({ value: 1, earned: 1 });
    expect(b['daily-streak']!.value).toBe(1);
    expect(b['game-streak']!.value).toBe(1);
  });

  it('has no next milestone once every level is earned', () => {
    const results = Array.from({ length: 25 }, (_, i) => r(`g${i}`, 0));
    expect(byId(computeBadges(results)).explorer).toMatchObject({ earned: 3, next: null });
  });
});

describe('badge announcements', () => {
  const results = Array.from({ length: 10 }, (_, i) => r('wordle', i));

  it('announces only levels above what was seen, naming the highest milestone', () => {
    const badges = computeBadges(results);
    expect(levelsOf(badges)).toMatchObject({
      logged: 2,
      solved: 1,
      'daily-streak': 2,
      'game-streak': 1,
    });
    expect(
      newBadgeLevels(badges, { logged: 1, solved: 1, 'daily-streak': 2, 'game-streak': 1 }),
    ).toEqual([expect.objectContaining({ id: 'logged', milestone: 10 })]);
    // Several passed at once: one announcement, for the highest.
    const skipped = newBadgeLevels(badges, { logged: 0 }).find((n) => n.id === 'logged');
    expect(skipped!.milestone).toBe(10);
  });

  it('has nothing to announce once everything is seen', () => {
    const badges = computeBadges(results);
    expect(newBadgeLevels(badges, levelsOf(badges))).toEqual([]);
  });
});
