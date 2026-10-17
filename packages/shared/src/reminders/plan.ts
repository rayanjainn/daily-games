import { currentPuzzle, type PuzzleClock } from '../time/puzzle';
import { localDate, wallClock } from '../time/zoned';

/** The cron runs every SLOT_MINUTES; a reminder fires in the slot that contains its time. */
export const SLOT_MINUTES = 15;

export interface Notification {
  title: string;
  body: string;
  url: string;
  /** Replaces an earlier undelivered notification with the same tag (and topic). */
  tag: string;
}

export interface PlannedReminder {
  userId: string;
  /** Dedupe key, unique per player: never send the same reminder twice. */
  key: string;
  notification: Notification;
}

/** "07:30" or "07:30:00" → minutes after midnight. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

export function localMinutes(now: Date, tz: string): number {
  const w = wallClock(now, tz);
  return w.hour * 60 + w.minute;
}

/** True when `at` falls in the same cron slot as the player's current local time. */
export function isDue(at: string, now: Date, tz: string): boolean {
  return (
    Math.floor(minutesOf(at) / SLOT_MINUTES) === Math.floor(localMinutes(now, tz) / SLOT_MINUTES)
  );
}

/** Quiet hours may wrap midnight (22:00–07:00). Equal or missing bounds mean no quiet hours. */
export function inQuietHours(minutes: number, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const s = minutesOf(start);
  const e = minutesOf(end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

export interface PlayerTime {
  userId: string;
  timezone: string;
  quietStart: string | null;
  quietEnd: string | null;
}

export interface GameReminderCandidate extends PlayerTime {
  remindAt: string;
  game: { id: string; name: string; slug: string; clock: PuzzleClock };
}

/**
 * Per-game reminders that are due now: in this slot, outside quiet hours, and only when
 * today's puzzle isn't logged yet (`logged` answers that).
 */
export function planGameReminders(
  candidates: GameReminderCandidate[],
  logged: (userId: string, gameId: string, puzzleNumber: number) => boolean,
  now: Date,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const c of candidates) {
    if (!isDue(c.remindAt, now, c.timezone)) continue;
    if (inQuietHours(localMinutes(now, c.timezone), c.quietStart, c.quietEnd)) continue;
    const puzzle = currentPuzzle(c.game.clock, now, c.timezone).number;
    if (logged(c.userId, c.game.id, puzzle)) continue;
    out.push({
      userId: c.userId,
      key: `game:${c.game.id}:${puzzle}`,
      notification: {
        title: `${c.game.name} is waiting`,
        body: "Today's puzzle isn't logged yet. Tap to play and log it.",
        url: `/games/${c.game.slug}`,
        tag: `game-${c.game.slug}`.slice(0, 32),
      },
    });
  }
  return out;
}

export interface StreakCandidate extends PlayerTime {
  nudgeAt: string;
  streaks: {
    gameId: string;
    name: string;
    current: number;
    lastPuzzleNumber: number | null;
    clock: PuzzleClock;
  }[];
}

const list = (names: string[]) =>
  names.length === 1
    ? names[0]!
    : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * One "streak at risk" nudge per player per day: streaks that were alive yesterday but have no
 * result for today's puzzle yet, longest first.
 */
export function planStreakNudges(candidates: StreakCandidate[], now: Date): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const c of candidates) {
    if (!isDue(c.nudgeAt, now, c.timezone)) continue;
    if (inQuietHours(localMinutes(now, c.timezone), c.quietStart, c.quietEnd)) continue;
    const atRisk = c.streaks
      .filter(
        (s) =>
          s.current > 0 &&
          s.lastPuzzleNumber === currentPuzzle(s.clock, now, c.timezone).number - 1,
      )
      .sort((a, b) => b.current - a.current);
    if (!atRisk.length) continue;
    const top = atRisk[0]!;
    const names = atRisk.slice(0, 3).map((s) => s.name);
    if (atRisk.length > 3) names.push(`${atRisk.length - 3} more`);
    out.push({
      userId: c.userId,
      key: `streak:${localDate(now, c.timezone)}`,
      notification: {
        title:
          atRisk.length === 1
            ? `Your ${top.current}-day ${top.name} streak is at risk`
            : `${atRisk.length} streaks are at risk`,
        body: `Play ${list(names)} before the next puzzle to keep ${atRisk.length === 1 ? 'it' : 'them'} going.`,
        url: '/today',
        tag: 'streak',
      },
    });
  }
  return out;
}
