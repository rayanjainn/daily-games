import { describe, expect, it } from 'vitest';
import { buildCheckoff, buildManualResult, type EntryGame } from './entry';

const NOW = new Date('2026-10-17T12:00:00Z');

const wordle: EntryGame = {
  slug: 'wordle',
  tier: 1,
  scoringType: 'attempts',
  maxAttempts: 6,
  numberingPublic: true,
  clock: {
    reset: { mode: 'user_local', hour: 0 },
    numbering: { epoch: '2021-06-19', epochNumber: 0 },
  },
};
const mini: EntryGame = {
  ...wordle,
  slug: 'nyt-mini',
  scoringType: 'time',
  maxAttempts: null,
  numberingPublic: false,
  clock: {
    reset: { mode: 'fixed', timezone: 'America/New_York', hour: -2, graceHours: 4 },
    numbering: { epoch: '2014-08-21', epochNumber: 1 },
  },
};
const tradle: EntryGame = { ...wordle, slug: 'tradle', tier: 3, scoringType: 'completion' };

describe('buildManualResult', () => {
  it("defaults to today's puzzle in the player's zone", () => {
    const r = buildManualResult(wordle, { solved: true, attempts: 4 }, NOW, 'UTC');
    expect(r).toMatchObject({
      ok: true,
      value: { puzzleNumber: 1946, puzzleDate: '2026-10-17', attempts: 4, maxAttempts: 6 },
    });
    // Already the 18th in Kiritimati (UTC+14).
    const k = buildManualResult(wordle, { solved: true, attempts: 4 }, NOW, 'Pacific/Kiritimati');
    expect(k.ok && k.value.puzzleNumber).toBe(1947);
  });

  it('requires the value the game scores by, within limits', () => {
    expect(buildManualResult(wordle, { solved: true }, NOW, 'UTC')).toMatchObject({ ok: false });
    expect(buildManualResult(wordle, { solved: true, attempts: 7 }, NOW, 'UTC')).toMatchObject({
      ok: false,
      message: 'This game allows at most 6 guesses.',
    });
    expect(buildManualResult(wordle, { solved: true, attempts: 0 }, NOW, 'UTC').ok).toBe(false);
    expect(buildManualResult(mini, { solved: true }, NOW, 'UTC').ok).toBe(false);
    expect(buildManualResult(mini, { solved: true, timeSeconds: 41 }, NOW, 'UTC')).toMatchObject({
      ok: true,
      value: { timeSeconds: 41 },
    });
  });

  it('rejects future and pre-epoch puzzles', () => {
    expect(
      buildManualResult(wordle, { solved: true, attempts: 3, puzzleNumber: 1948 }, NOW, 'UTC'),
    ).toMatchObject({ ok: false, code: 'future_puzzle' });
    expect(
      buildManualResult(wordle, { solved: true, attempts: 3, puzzleNumber: -1 }, NOW, 'UTC'),
    ).toMatchObject({ ok: false, code: 'before_epoch' });
    // Earlier puzzles (archive) are fine.
    expect(
      buildManualResult(wordle, { solved: true, attempts: 3, puzzleNumber: 1900 }, NOW, 'UTC'),
    ).toMatchObject({ ok: true, value: { puzzleDate: '2026-09-01' } });
  });

  it('refuses scores for check-off games', () => {
    expect(buildManualResult(tradle, { solved: true }, NOW, 'UTC').ok).toBe(false);
  });
});

describe('buildCheckoff', () => {
  it("marks today's puzzle done", () => {
    expect(buildCheckoff(tradle, undefined, NOW, 'UTC')).toMatchObject({
      ok: true,
      value: { solved: true, puzzleNumber: 1946, puzzleDate: '2026-10-17' },
    });
  });

  it('rejects tomorrow', () => {
    expect(buildCheckoff(tradle, 1948, NOW, 'UTC')).toMatchObject({
      ok: false,
      code: 'future_puzzle',
    });
  });
});
