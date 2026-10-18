import { describe, expect, it } from 'vitest';
import { resultPoints, totalPoints } from './points';

const solved = (attempts: number | null, maxAttempts: number | null = 6) => ({
  solved: true,
  attempts,
  maxAttempts,
});

describe('resultPoints', () => {
  it('scores guess games from 100 down to 60', () => {
    expect(resultPoints(solved(1), 'attempts')).toBe(100);
    expect(resultPoints(solved(3), 'attempts')).toBe(84);
    expect(resultPoints(solved(6), 'attempts')).toBe(60);
    expect(resultPoints(solved(4, 4), 'attempts')).toBe(60);
    expect(resultPoints(solved(2, 4), 'attempts')).toBe(87);
  });

  it('gives a solve with unknown guesses 60, and other games a flat 70', () => {
    expect(resultPoints(solved(null), 'attempts')).toBe(60);
    expect(resultPoints(solved(3, null), 'attempts')).toBe(60);
    for (const t of ['time', 'points', 'distance', 'completion'] as const)
      expect(resultPoints(solved(null, null), t)).toBe(70);
  });

  it('scores nothing for a miss or a catch-up', () => {
    expect(resultPoints({ solved: false, attempts: 6, maxAttempts: 6 }, 'attempts')).toBe(0);
    expect(resultPoints({ ...solved(2), fromArchive: true }, 'attempts')).toBe(0);
  });

  it('stays within bounds even for odd data', () => {
    expect(resultPoints(solved(0), 'attempts')).toBe(60);
    expect(resultPoints(solved(9), 'attempts')).toBe(60);
    expect(resultPoints(solved(1, 1), 'attempts')).toBe(60);
  });
});

describe('totalPoints', () => {
  it('adds up across games', () => {
    expect(
      totalPoints([
        { result: solved(3), scoring: 'attempts' },
        { result: solved(null, null), scoring: 'time' },
        { result: { solved: false, attempts: 6, maxAttempts: 6 }, scoring: 'attempts' },
      ]),
    ).toBe(154);
    expect(totalPoints([])).toBe(0);
  });
});
