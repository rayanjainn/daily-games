import { describe, expect, it } from 'vitest';
import {
  currentPuzzle,
  dateForPuzzleNumber,
  latestAvailablePuzzleNumber,
  nextResetAt,
  puzzleDateAt,
  puzzleNumberForDate,
  resetInstantForDate,
  type PuzzleClock,
} from './puzzle';
import { addDays, daysBetween, isValidTimeZone, offsetMinutes, zonedTimeToInstant } from './zoned';

const wordle: PuzzleClock = {
  reset: { mode: 'user_local' },
  numbering: { epoch: '2021-06-19', epochNumber: 0 },
};
const connections: PuzzleClock = {
  reset: { mode: 'user_local' },
  numbering: { epoch: '2023-06-12', epochNumber: 1 },
};
/** Releases at 22:00 New York time the evening before, plus up to 4h early on weekends. */
const mini: PuzzleClock = {
  reset: { mode: 'fixed', timezone: 'America/New_York', hour: -2, graceHours: 4 },
  numbering: { epoch: '2014-08-21', epochNumber: 1 },
};
/** Resets at 03:00 New York time. */
const bee: PuzzleClock = {
  reset: { mode: 'fixed', timezone: 'America/New_York', hour: 3 },
  numbering: { epoch: '2018-05-09', epochNumber: 1 },
};

const at = (iso: string) => new Date(iso);

describe('calendar helpers', () => {
  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2021-06-19', '2024-03-15')).toBe(1000);
  });

  it('rejects impossible dates', () => {
    expect(() => addDays('2026-02-30', 0)).toThrow();
    expect(() => addDays('17-10-2026', 0)).toThrow();
  });

  it('validates IANA zones', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('reads offsets including half-hour zones and DST', () => {
    expect(offsetMinutes(at('2026-01-15T12:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(offsetMinutes(at('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-300);
    expect(offsetMinutes(at('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-240);
    expect(offsetMinutes(at('2026-01-15T12:00:00Z'), 'Australia/Adelaide')).toBe(630);
  });

  it('converts wall time to instants across DST transitions', () => {
    // New York springs forward 2026-03-08 02:00 → 03:00; 02:30 does not exist.
    expect(
      zonedTimeToInstant(
        { year: 2026, month: 3, day: 8, hour: 1, minute: 30 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-03-08T06:30:00.000Z');
    expect(
      zonedTimeToInstant(
        { year: 2026, month: 3, day: 8, hour: 3, minute: 0 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-03-08T07:00:00.000Z');
    const skipped = zonedTimeToInstant(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      'America/New_York',
    );
    expect(skipped.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    // Falls back 2026-11-01 02:00 → 01:00; 01:30 happens twice, first occurrence wins.
    expect(
      zonedTimeToInstant(
        { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('puzzle numbers', () => {
  it('matches known Wordle and Connections numbers', () => {
    expect(puzzleNumberForDate(wordle, '2021-06-19')).toBe(0);
    expect(puzzleNumberForDate(wordle, '2024-03-15')).toBe(1000);
    expect(dateForPuzzleNumber(wordle, 1000)).toBe('2024-03-15');
    expect(puzzleNumberForDate(connections, '2023-06-12')).toBe(1);
    expect(dateForPuzzleNumber(connections, 500)).toBe('2024-10-23');
  });

  it('gives players in different timezones different user-local puzzles at the same instant', () => {
    const now = at('2026-10-17T20:00:00Z'); // 01:30 Oct 18 in Kolkata, 13:00 Oct 17 in LA
    expect(currentPuzzle(wordle, now, 'Asia/Kolkata').date).toBe('2026-10-18');
    expect(currentPuzzle(wordle, now, 'America/Los_Angeles').date).toBe('2026-10-17');
    expect(
      currentPuzzle(wordle, now, 'Asia/Kolkata').number -
        currentPuzzle(wordle, now, 'America/Los_Angeles').number,
    ).toBe(1);
  });

  it('rolls user-local puzzles over exactly at local midnight', () => {
    expect(puzzleDateAt(wordle.reset, at('2026-10-17T06:59:59Z'), 'America/Los_Angeles')).toBe(
      '2026-10-16',
    );
    expect(puzzleDateAt(wordle.reset, at('2026-10-17T07:00:00Z'), 'America/Los_Angeles')).toBe(
      '2026-10-17',
    );
  });

  it('applies fixed-timezone resets the same for everyone', () => {
    const now = at('2026-10-17T06:30:00Z'); // 02:30 New York → before the 03:00 bee reset
    expect(puzzleDateAt(bee.reset, now, 'Asia/Tokyo')).toBe('2026-10-16');
    expect(puzzleDateAt(bee.reset, now, 'America/Los_Angeles')).toBe('2026-10-16');
    expect(puzzleDateAt(bee.reset, at('2026-10-17T07:00:00Z'), 'Europe/London')).toBe('2026-10-17');
  });

  it('handles negative reset hours (released the evening before)', () => {
    // 21:59 New York Thursday → still Thursday's mini; 22:00 → Friday's.
    expect(puzzleDateAt(mini.reset, at('2026-10-16T01:59:00Z'), 'UTC')).toBe('2026-10-15');
    expect(puzzleDateAt(mini.reset, at('2026-10-16T02:00:00Z'), 'UTC')).toBe('2026-10-16');
  });

  it('keeps the reset on the wall clock across DST changes', () => {
    // Bee resets at 03:00 local both before and after the 2026-11-01 fall-back.
    expect(resetInstantForDate(bee.reset, '2026-10-31', 'UTC').toISOString()).toBe(
      '2026-10-31T07:00:00.000Z',
    );
    expect(resetInstantForDate(bee.reset, '2026-11-01', 'UTC').toISOString()).toBe(
      '2026-11-01T08:00:00.000Z',
    );
    // Spring forward: 2026-03-08 03:00 exists (just after the gap).
    expect(resetInstantForDate(bee.reset, '2026-03-08', 'UTC').toISOString()).toBe(
      '2026-03-08T07:00:00.000Z',
    );
    // A user-local midnight reset on a DST day in a zone that changes at midnight (Santiago).
    const santiago = resetInstantForDate(wordle.reset, '2026-09-06', 'America/Santiago');
    expect(santiago.toISOString()).toBe('2026-09-06T04:00:00.000Z');
  });

  it('computes the next reset', () => {
    expect(
      nextResetAt(wordle.reset, at('2026-10-17T12:00:00Z'), 'Asia/Kolkata').toISOString(),
    ).toBe('2026-10-17T18:30:00.000Z');
    expect(nextResetAt(mini.reset, at('2026-10-17T12:00:00Z'), 'Asia/Kolkata').toISOString()).toBe(
      '2026-10-18T02:00:00.000Z',
    );
  });

  it('allows the newest puzzle anyone on Earth could have, and no further', () => {
    const now = at('2026-10-17T11:00:00Z'); // already Oct 18 01:00 in Kiritimati (UTC+14)
    expect(latestAvailablePuzzleNumber(wordle, now)).toBe(
      puzzleNumberForDate(wordle, '2026-10-18'),
    );
    expect(latestAvailablePuzzleNumber(wordle, at('2026-10-17T09:59:00Z'))).toBe(
      puzzleNumberForDate(wordle, '2026-10-17'),
    );
  });

  it('extends the latest available puzzle by the grace window for fixed resets', () => {
    // Saturday's mini appears ~18:00 New York on Friday; 19:00 NY Friday = 23:00Z.
    const fridayEvening = at('2026-10-16T23:00:00Z');
    expect(latestAvailablePuzzleNumber(mini, fridayEvening)).toBe(
      puzzleNumberForDate(mini, '2026-10-17'),
    );
    const noGrace = { ...mini, reset: { ...mini.reset, graceHours: 0 } };
    expect(latestAvailablePuzzleNumber(noGrace, fridayEvening)).toBe(
      puzzleNumberForDate(mini, '2026-10-16'),
    );
  });
});
