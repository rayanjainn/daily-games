import { describe, expect, it } from 'vitest';
import { computeStreak, dayIndex } from './streak';

describe('computeStreak', () => {
  it('is out with no plays', () => {
    expect(computeStreak([], 100)).toEqual({ current: 0, best: 0, state: 'out', last: null });
  });

  it('counts a run ending today as active', () => {
    expect(computeStreak([97, 98, 99, 100], 100)).toMatchObject({
      current: 4,
      best: 4,
      state: 'active',
    });
  });

  it('keeps a run ending yesterday alive but at risk', () => {
    expect(computeStreak([98, 99], 100)).toMatchObject({ current: 2, state: 'at-risk', last: 99 });
  });

  it('breaks after a missed day and remembers the best run', () => {
    expect(computeStreak([90, 91, 92, 93, 94, 97], 100)).toMatchObject({
      current: 0,
      best: 5,
      state: 'out',
    });
    expect(computeStreak([90, 91, 92, 99, 100], 100)).toMatchObject({ current: 2, best: 3 });
  });

  it('ignores duplicates, order and future days', () => {
    expect(computeStreak([100, 99, 99, 101, 98], 100)).toMatchObject({
      current: 3,
      best: 3,
      state: 'active',
      last: 100,
    });
  });
});

describe('dayIndex', () => {
  it('maps consecutive dates to consecutive integers across DST and leap days', () => {
    expect(dayIndex('2024-02-29') - dayIndex('2024-02-28')).toBe(1);
    expect(dayIndex('2024-03-01') - dayIndex('2024-02-29')).toBe(1);
    expect(dayIndex('2026-03-09') - dayIndex('2026-03-08')).toBe(1);
    expect(dayIndex('1970-01-01')).toBe(0);
  });
});
