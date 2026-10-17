import { describe, expect, it } from 'vitest';
import { formatDuration, formatResult } from './format';

const r = (over: object) => ({
  solved: true,
  attempts: null,
  maxAttempts: null,
  timeSeconds: null,
  score: null,
  ...over,
});

describe('formatResult', () => {
  it('formats attempts, including failures', () => {
    expect(formatResult(r({ attempts: 4, maxAttempts: 6 }), { type: 'attempts' })).toBe('4/6');
    expect(
      formatResult(r({ solved: false, attempts: 6, maxAttempts: 6 }), { type: 'attempts' }),
    ).toBe('X/6');
  });

  it('formats times', () => {
    expect(formatResult(r({ timeSeconds: 42 }), { type: 'time' })).toBe('0:42');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('formats points and distances with units', () => {
    expect(formatResult(r({ score: 1250 }), { type: 'points' })).toBe('1,250 pts');
    expect(formatResult(r({ score: 3 }), { type: 'distance', unit: 'guesses' })).toBe('3 guesses');
  });

  it('falls back when a value is missing, and says Done for check-offs', () => {
    expect(formatResult(r({}), { type: 'attempts' })).toBe('Solved');
    expect(formatResult(r({}), { type: 'completion' })).toBe('Done');
  });
});
