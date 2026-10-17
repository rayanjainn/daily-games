import { describe, expect, it } from 'vitest';
import { weekPoster } from './week';

describe('weekPoster', () => {
  it('lays out seven days per game with totals', () => {
    const p = weekPoster('2026-10-17', [
      {
        name: 'Wordle',
        accentColor: '#000000',
        results: [
          { puzzleDate: '2026-10-17', solved: true },
          { puzzleDate: '2026-10-15', solved: false },
          { puzzleDate: '2026-10-09', solved: true }, // before the week
        ],
      },
      {
        name: 'Tradle',
        accentColor: '#111111',
        results: [{ puzzleDate: '2026-10-11', solved: true }],
      },
    ]);
    expect(p.days).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ]);
    expect(p.rows[0]!.tiles).toEqual([
      'missed',
      'missed',
      'missed',
      'missed',
      'failed',
      'missed',
      'solved',
    ]);
    expect(p.rows[1]!.tiles[0]).toBe('solved');
    expect(p).toMatchObject({ played: 3, solved: 2, activeDays: 3 });
  });

  it('caps the rows and merges same-day results', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `G${i}`,
      accentColor: '#000000',
      results: [],
    }));
    expect(weekPoster('2026-10-17', many).rows).toHaveLength(8);
    const merged = weekPoster('2026-10-17', [
      {
        name: 'W',
        accentColor: '#000000',
        results: [
          { puzzleDate: '2026-10-17', solved: false },
          { puzzleDate: '2026-10-17', solved: true },
        ],
      },
    ]);
    expect(merged.rows[0]!.tiles[6]).toBe('solved');
    expect(merged.played).toBe(1);
  });
});
