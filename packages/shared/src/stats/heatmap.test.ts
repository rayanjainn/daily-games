import { describe, expect, it } from 'vitest';
import { buildHeatmap } from './heatmap';

describe('buildHeatmap', () => {
  it('lays out Monday-first weeks ending with the current week', () => {
    // 2026-10-17 is a Saturday.
    const g = buildHeatmap([], '2026-10-17', 2);
    expect(g).toHaveLength(2);
    expect(g[0]![0]!.date).toBe('2026-10-05');
    expect(g[1]![0]!.date).toBe('2026-10-12');
    expect(g[1]![5]).toEqual({ date: '2026-10-17', state: 'none' });
    expect(g[1]![6]).toEqual({ date: '2026-10-18', state: 'future' });
  });

  it('marks solved and failed days', () => {
    const g = buildHeatmap(
      [
        { date: '2026-10-16', solved: true },
        { date: '2026-10-15', solved: false },
      ],
      '2026-10-17',
      1,
    );
    expect(g[0]!.map((d) => d.state)).toEqual([
      'none',
      'none',
      'none',
      'failed',
      'solved',
      'none',
      'future',
    ]);
  });
});
