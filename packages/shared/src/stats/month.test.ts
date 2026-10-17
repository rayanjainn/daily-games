import { describe, expect, it } from 'vitest';
import { monthRecap, previousMonth, weekdayOf, type MonthResult } from './month';

const games = [
  { id: 'w', name: 'Wordle', accentColor: '#6aaa64' },
  { id: 'c', name: 'Connections', accentColor: '#b4a7d6' },
  { id: 't', name: 'Tradle', accentColor: '#3b82f6' },
  { id: 'm', name: 'Mini', accentColor: '#4b9cd3' },
];
const r = (gameId: string, puzzleDate: string, extra: Partial<MonthResult> = {}): MonthResult => ({
  gameId,
  puzzleDate,
  solved: true,
  fromArchive: false,
  ...extra,
});

describe('monthRecap', () => {
  it('counts the month so far and leaves later days empty', () => {
    const rec = monthRecap(
      '2026-10',
      '2026-10-17',
      [
        r('w', '2026-10-01'),
        r('w', '2026-10-02'),
        r('w', '2026-10-03', { solved: false }),
        r('c', '2026-10-03'),
        r('w', '2026-09-30'),
        r('w', '2026-11-01'),
      ],
      games,
    );
    expect(rec.days).toHaveLength(31);
    expect(rec.elapsed).toBe(17);
    expect(rec.perDay.slice(0, 4)).toEqual([1, 1, 2, 0]);
    expect(rec.perDay[17]).toBeNull();
    expect(rec).toMatchObject({ played: 4, solved: 3, activeDays: 3, bestStreak: 3 });
    expect(rec.top.map((g) => [g.name, g.played, g.solved])).toEqual([
      ['Wordle', 3, 2],
      ['Connections', 1, 1],
    ]);
  });

  it('a finished month counts every day', () => {
    const rec = monthRecap('2026-02', '2026-10-17', [], games);
    expect(rec.days).toHaveLength(28);
    expect(rec.elapsed).toBe(28);
    expect(rec.busiestWeekday).toBeNull();
    expect(rec.bestStreak).toBe(0);
  });

  it('catch-ups count in their puzzle month but not in the streak', () => {
    const rec = monthRecap(
      '2026-10',
      '2026-10-17',
      [r('w', '2026-10-05'), r('w', '2026-10-06', { fromArchive: true }), r('w', '2026-10-07')],
      games,
    );
    expect(rec.played).toBe(3);
    expect(rec.bestStreak).toBe(1);
  });

  it('keeps the top games and finds the busiest weekday', () => {
    // 2026-10-03 and 2026-10-10 are Saturdays.
    const rec = monthRecap(
      '2026-10',
      '2026-10-17',
      [
        r('w', '2026-10-03'),
        r('c', '2026-10-03'),
        r('t', '2026-10-10'),
        r('m', '2026-10-05'),
        r('m', '2026-10-06'),
      ],
      games,
      2,
    );
    expect(rec.top.map((g) => g.name)).toEqual(['Mini', 'Connections']);
    expect(rec.busiestWeekday).toBe(5);
  });
});

describe('month helpers', () => {
  it('steps back a month across a year', () => {
    expect(previousMonth('2026-10')).toBe('2026-09');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
  it('weekdays start on Monday', () => {
    expect(weekdayOf('2026-10-12')).toBe(0);
    expect(weekdayOf('2026-10-18')).toBe(6);
  });
});
