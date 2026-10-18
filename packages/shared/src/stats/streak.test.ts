import { describe, expect, it } from 'vitest';
import { computeFrozenStreak, computeStreak, dayIndex, FREEZE_EVERY, MAX_FREEZES } from './streak';

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

describe('computeFrozenStreak', () => {
  const run = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it('is out with no plays and 7 days from the first freeze', () => {
    expect(computeFrozenStreak([], 100)).toEqual({
      current: 0,
      best: 0,
      state: 'out',
      last: null,
      freezes: 0,
      nextFreezeIn: FREEZE_EVERY,
      frozenDays: [],
    });
  });

  it('behaves like the plain streak until a freeze is earned', () => {
    for (const played of [[97, 98, 99, 100], [98, 99], [90, 91, 95, 96, 97], [100], [94, 96, 97]])
      for (const today of [100, 101]) {
        const plain = computeStreak(played, today);
        expect(computeFrozenStreak(played, today)).toMatchObject({
          current: plain.current,
          best: plain.best,
          state: plain.state,
        });
      }
  });

  it('earns a freeze after seven days in a row and shows the next one', () => {
    const s = computeFrozenStreak(run(1, 7), 7);
    expect(s).toMatchObject({ current: 7, state: 'active', freezes: 1, nextFreezeIn: 7 });
    expect(computeFrozenStreak(run(1, 10), 10)).toMatchObject({ freezes: 1, nextFreezeIn: 4 });
  });

  it('a missed day uses a freeze and the streak carries on', () => {
    const s = computeFrozenStreak([...run(1, 7), 9], 9);
    expect(s).toMatchObject({
      current: 8, // the frozen day itself doesn't count
      best: 8,
      state: 'active',
      freezes: 0,
      frozenDays: [8],
    });
  });

  it('without a freeze, a missed day still ends the streak', () => {
    const s = computeFrozenStreak([...run(1, 7), 9, 11], 11);
    // Day 8 was frozen; day 10 had nothing left to cover it.
    expect(s).toMatchObject({ current: 1, best: 8, state: 'active', frozenDays: [] });
  });

  it('today never costs a freeze while it can still be played', () => {
    const s = computeFrozenStreak(run(1, 7), 8);
    expect(s).toMatchObject({ current: 7, state: 'at-risk', freezes: 1, frozenDays: [] });
  });

  it('a frozen yesterday leaves the streak at risk, not lost', () => {
    const s = computeFrozenStreak(run(1, 7), 9);
    expect(s).toMatchObject({ current: 7, state: 'at-risk', freezes: 0, frozenDays: [8] });
  });

  it('holds at most two freezes', () => {
    const s = computeFrozenStreak(run(1, 28), 28);
    expect(s).toMatchObject({ current: 28, freezes: MAX_FREEZES, nextFreezeIn: null });
  });

  it('two banked freezes cover two missed days, not three', () => {
    const played = [...run(1, 14), 18];
    // 15 and 16 are frozen; 17 ends the streak, so 18 starts a new one.
    expect(computeFrozenStreak(played, 18)).toMatchObject({
      current: 1,
      best: 14,
      state: 'active',
      freezes: 0,
    });
    expect(computeFrozenStreak([...run(1, 14), 17], 17)).toMatchObject({
      current: 15,
      frozenDays: [15, 16],
    });
  });

  it('ignores anything after today', () => {
    expect(computeFrozenStreak([5, 6, 200], 6)).toMatchObject({ current: 2, last: 6 });
  });
});
