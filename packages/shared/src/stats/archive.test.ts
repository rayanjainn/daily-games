import { describe, expect, it } from 'vitest';
import type { PuzzleClock } from '../time/puzzle';
import { archiveDays } from './archive';

const clock: PuzzleClock = {
  reset: { mode: 'user_local', hour: 0 },
  numbering: { epoch: '2026-10-01', epochNumber: 1 },
};

describe('archiveDays', () => {
  it('lists the window before today, newest first, with what was logged', () => {
    const logged = new Map([
      [15, { solved: true, fromArchive: false }],
      [12, { solved: false, fromArchive: true }],
    ]);
    const days = archiveDays(clock, 17, 1, logged, 5);
    expect(days.map((d) => d.puzzleNumber)).toEqual([16, 15, 14, 13, 12]);
    expect(days[0]).toEqual({ puzzleNumber: 16, puzzleDate: '2026-10-16', logged: null });
    expect(days[1]!.logged).toEqual({ solved: true, fromArchive: false });
    expect(days[4]!.logged).toEqual({ solved: false, fromArchive: true });
  });

  it('starts no earlier than the follow date or the first puzzle', () => {
    expect(archiveDays(clock, 17, 15, new Map()).map((d) => d.puzzleNumber)).toEqual([16, 15]);
    expect(archiveDays(clock, 3, 1, new Map()).map((d) => d.puzzleNumber)).toEqual([2, 1]);
    expect(archiveDays(clock, 1, 1, new Map())).toEqual([]);
  });
});
