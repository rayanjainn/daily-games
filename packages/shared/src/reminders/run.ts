import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import {
  follows,
  games,
  pushSubscriptions,
  reminderDeliveries,
  results,
  streaks,
  users,
} from '../db/schema';
import { clockFromGame } from '../registry/clock';
import {
  planGameReminders,
  planStreakNudges,
  SLOT_MINUTES,
  type GameReminderCandidate,
  type PlannedReminder,
  type StreakCandidate,
} from './plan';

/** Deliveries older than this are pruned; they only exist to stop duplicates. */
const KEEP_DAYS = 14;

/** `col` (a time) is in the same cron slot as the player's local time at `now`. */
const sameSlot = (col: unknown, now: Date) => sql`
  ((extract(hour from ${col}) * 60 + extract(minute from ${col}))::int / ${SLOT_MINUTES})
  = ((extract(hour from (${now.toISOString()}::timestamptz AT TIME ZONE ${users.timezone})) * 60
     + extract(minute from (${now.toISOString()}::timestamptz AT TIME ZONE ${users.timezone})))::int
     / ${SLOT_MINUTES})`;

/** Not deleted, and reachable: a push device, or a verified email with email reminders on. */
const canReceive = sql`${users.deletedAt} IS NULL AND (EXISTS (
  SELECT 1 FROM ${pushSubscriptions} WHERE ${pushSubscriptions.userId} = ${users.id})
  OR (${users.emailReminders} AND ${users.emailVerifiedAt} IS NOT NULL))`;

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/**
 * One cron run: finds the reminders due in this slot, records each one (skipping any already
 * sent), and returns what to deliver. Safe to run twice for the same slot.
 */
export async function planDueReminders(db: Database, now = new Date()): Promise<PlannedReminder[]> {
  const gameRows = await db
    .select({
      userId: users.id,
      timezone: users.timezone,
      quietStart: users.quietHoursStart,
      quietEnd: users.quietHoursEnd,
      remindAt: follows.remindAt,
      game: games,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.userId))
    .innerJoin(games, eq(games.id, follows.gameId))
    .where(
      and(
        sql`${follows.remindAt} IS NOT NULL`,
        sql`${games.status} <> 'archived'`,
        canReceive,
        sameSlot(follows.remindAt, now),
      ),
    );

  const gameCandidates: GameReminderCandidate[] = gameRows.map((r) => ({
    userId: r.userId,
    timezone: r.timezone,
    quietStart: hhmm(r.quietStart),
    quietEnd: hhmm(r.quietEnd),
    remindAt: r.remindAt!,
    game: { id: r.game.id, name: r.game.name, slug: r.game.slug, clock: clockFromGame(r.game) },
  }));

  const loggedSet = new Set<string>();
  if (gameCandidates.length) {
    const rows = await db
      .select({ userId: results.userId, gameId: results.gameId, n: results.puzzleNumber })
      .from(results)
      .where(
        and(
          inArray(results.userId, [...new Set(gameCandidates.map((c) => c.userId))]),
          inArray(results.gameId, [...new Set(gameCandidates.map((c) => c.game.id))]),
          // Recent results are enough: today's puzzle is the newest anyone can log.
          gt(results.createdAt, new Date(now.getTime() - 3 * 86_400_000)),
        ),
      );
    for (const r of rows) loggedSet.add(`${r.userId}:${r.gameId}:${r.n}`);
  }

  const nudgeRows = await db
    .select({
      userId: users.id,
      timezone: users.timezone,
      quietStart: users.quietHoursStart,
      quietEnd: users.quietHoursEnd,
      nudgeAt: users.streakNudgeAt,
      current: streaks.current,
      lastPuzzleNumber: streaks.lastPuzzleNumber,
      game: games,
    })
    .from(users)
    .innerJoin(follows, eq(follows.userId, users.id))
    .innerJoin(games, eq(games.id, follows.gameId))
    .innerJoin(streaks, and(eq(streaks.userId, users.id), eq(streaks.gameId, games.id)))
    .where(
      and(
        sql`${users.streakNudgeAt} IS NOT NULL`,
        gt(streaks.current, 0),
        sql`${games.status} <> 'archived'`,
        canReceive,
        sameSlot(users.streakNudgeAt, now),
      ),
    );
  const byUser = new Map<string, StreakCandidate>();
  for (const r of nudgeRows) {
    const c = byUser.get(r.userId) ?? {
      userId: r.userId,
      timezone: r.timezone,
      quietStart: hhmm(r.quietStart),
      quietEnd: hhmm(r.quietEnd),
      nudgeAt: r.nudgeAt!,
      streaks: [],
    };
    c.streaks.push({
      gameId: r.game.id,
      name: r.game.name,
      current: r.current,
      lastPuzzleNumber: r.lastPuzzleNumber,
      clock: clockFromGame(r.game),
    });
    byUser.set(r.userId, c);
  }

  const planned = [
    ...planGameReminders(gameCandidates, (u, g, n) => loggedSet.has(`${u}:${g}:${n}`), now),
    ...planStreakNudges([...byUser.values()], now),
  ];
  if (!planned.length) return [];

  const fresh = await db
    .insert(reminderDeliveries)
    .values(planned.map((p) => ({ userId: p.userId, key: p.key })))
    .onConflictDoNothing()
    .returning({ userId: reminderDeliveries.userId, key: reminderDeliveries.key });
  const isFresh = new Set(fresh.map((f) => `${f.userId}|${f.key}`));
  return planned.filter((p) => isFresh.has(`${p.userId}|${p.key}`));
}

export async function pruneDeliveries(db: Database, now = new Date()) {
  await db
    .delete(reminderDeliveries)
    .where(lt(reminderDeliveries.createdAt, new Date(now.getTime() - KEEP_DAYS * 86_400_000)));
}
