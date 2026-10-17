import { describe, expect, it } from 'vitest';
import type { PuzzleClock } from '../time/puzzle';
import {
  inQuietHours,
  isDue,
  minutesOf,
  planGameReminders,
  planStreakNudges,
  type GameReminderCandidate,
  type StreakCandidate,
} from './plan';

const clock: PuzzleClock = {
  reset: { mode: 'user_local', hour: 0 },
  numbering: { epoch: '2026-10-01', epochNumber: 1 },
};
// 2026-10-17 18:07 in New York (UTC-4); puzzle #17 there.
const NOW = new Date('2026-10-17T22:07:00Z');
const NY = 'America/New_York';

const player = { userId: 'u1', timezone: NY, quietStart: null, quietEnd: null };
const game = (remindAt: string, over: Partial<GameReminderCandidate> = {}) => ({
  ...player,
  remindAt,
  game: { id: 'g1', name: 'Wordle', slug: 'wordle', clock },
  ...over,
});

describe('time helpers', () => {
  it('reads times with or without seconds', () => {
    expect(minutesOf('07:30')).toBe(450);
    expect(minutesOf('23:59:00')).toBe(1439);
  });

  it('matches the 15-minute slot in the player’s timezone', () => {
    expect(isDue('18:00', NOW, NY)).toBe(true);
    expect(isDue('18:14:00', NOW, NY)).toBe(true);
    expect(isDue('18:15', NOW, NY)).toBe(false);
    expect(isDue('17:59', NOW, NY)).toBe(false);
    expect(isDue('03:30', NOW, 'Asia/Kolkata')).toBe(true); // 03:37 there
  });

  it('handles quiet hours that wrap midnight', () => {
    expect(inQuietHours(23 * 60, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(6 * 60, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(7 * 60, '22:00', '07:00')).toBe(false);
    expect(inQuietHours(13 * 60, '12:00', '14:00')).toBe(true);
    expect(inQuietHours(13 * 60, null, '14:00')).toBe(false);
    expect(inQuietHours(13 * 60, '09:00', '09:00')).toBe(false);
  });
});

describe('planGameReminders', () => {
  it('reminds when due and today is not logged, keyed by puzzle', () => {
    const [r] = planGameReminders([game('18:05')], () => false, NOW);
    expect(r).toEqual({
      userId: 'u1',
      key: 'game:g1:17',
      notification: {
        title: 'Wordle is waiting',
        body: "Today's puzzle isn't logged yet. Tap to play and log it.",
        url: '/games/wordle',
        tag: 'game-wordle',
      },
    });
  });

  it('skips logged games, other slots and quiet hours', () => {
    expect(planGameReminders([game('18:05')], (_u, _g, n) => n === 17, NOW)).toEqual([]);
    expect(planGameReminders([game('09:00')], () => false, NOW)).toEqual([]);
    expect(
      planGameReminders(
        [game('18:05', { quietStart: '18:00', quietEnd: '08:00' })],
        () => false,
        NOW,
      ),
    ).toEqual([]);
  });
});

describe('planStreakNudges', () => {
  const streak = (name: string, current: number, last: number | null) => ({
    gameId: name,
    name,
    current,
    lastPuzzleNumber: last,
    clock,
  });
  const nudge = (streaks: StreakCandidate['streaks']): StreakCandidate => ({
    ...player,
    nudgeAt: '18:00',
    streaks,
  });

  it('names the streaks alive yesterday but not played today, longest first', () => {
    const [r] = planStreakNudges(
      [
        nudge([
          streak('Wordle', 12, 16),
          streak('Connections', 30, 16),
          streak('Strands', 4, 17), // already played today
          streak('Globle', 0, 10),
        ]),
      ],
      NOW,
    );
    expect(r!.key).toBe('streak:2026-10-17');
    expect(r!.notification.title).toBe('2 streaks are at risk');
    expect(r!.notification.body).toBe(
      'Play Connections and Wordle before the next puzzle to keep them going.',
    );
  });

  it('uses the streak length when only one is at risk, and skips when none are', () => {
    const [r] = planStreakNudges([nudge([streak('Wordle', 12, 16)])], NOW);
    expect(r!.notification.title).toBe('Your 12-day Wordle streak is at risk');
    expect(planStreakNudges([nudge([streak('Wordle', 12, 17)])], NOW)).toEqual([]);
  });

  it('summarises long lists', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map((n, i) => streak(n, 10 - i, 16));
    const [r] = planStreakNudges([nudge(many)], NOW);
    expect(r!.notification.body).toBe(
      'Play A, B, C and 2 more before the next puzzle to keep them going.',
    );
  });
});
