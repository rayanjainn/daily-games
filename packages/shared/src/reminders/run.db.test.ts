import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
import { loadGames } from '../registry/loader';
import { seedGames } from '../registry/seed';
import { testDb, truncateAll } from '../test/db';
import { currentPuzzle, dateForPuzzleNumber } from '../time/puzzle';
import { planDueReminders, pruneDeliveries } from './run';

const { db, client } = testDb();
afterAll(() => client.end());

// 18:07 in New York.
const NOW = new Date('2026-10-17T22:07:00Z');
const catalog = loadGames().filter((g) => ['wordle', 'connections'].includes(g.spec.slug));

async function player(name: string, over: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db
    .insert(users)
    .values({ username: name, timezone: 'America/New_York', ...over })
    .returning();
  await db.insert(pushSubscriptions).values({
    userId: u!.id,
    endpoint: `https://push.example.com/${name}`,
    p256dh: 'k',
    auth: 'a',
  });
  return u!;
}
const gameId = async (slug: string) =>
  (await db.select().from(games).where(eq(games.slug, slug)))[0]!;

beforeEach(async () => {
  await truncateAll(db);
  await seedGames(db, catalog);
});

describe('planDueReminders', () => {
  it('reminds for unlogged games in this slot, once', async () => {
    const u = await player('ava');
    const wordle = await gameId('wordle');
    const conn = await gameId('connections');
    await db.insert(follows).values([
      { userId: u.id, gameId: wordle.id, remindAt: '18:00' },
      { userId: u.id, gameId: conn.id, remindAt: '18:10' },
    ]);
    const today = currentPuzzle(clockFromGame(conn), NOW, u.timezone).number;
    await db.insert(results).values({
      userId: u.id,
      gameId: conn.id,
      puzzleNumber: today,
      puzzleDate: dateForPuzzleNumber(clockFromGame(conn), today),
      solved: true,
      source: 'checkbox',
      createdAt: new Date(NOW.getTime() - 3_600_000),
    });

    const first = await planDueReminders(db, NOW);
    expect(first.map((p) => p.notification.title)).toEqual(['Wordle is waiting']);
    // The next cron tick in the same slot (or an overlapping run) sends nothing new.
    expect(await planDueReminders(db, new Date(NOW.getTime() + 60_000))).toEqual([]);
  });

  it('skips players without a device, deleted players and other slots', async () => {
    const wordle = await gameId('wordle');
    const [nodevice] = await db
      .insert(users)
      .values({ username: 'nodevice', timezone: 'America/New_York' })
      .returning();
    const gone = await player('gone', { deletedAt: new Date() });
    const later = await player('later');
    await db.insert(follows).values([
      { userId: nodevice!.id, gameId: wordle.id, remindAt: '18:00' },
      { userId: gone.id, gameId: wordle.id, remindAt: '18:00' },
      { userId: later.id, gameId: wordle.id, remindAt: '21:00' },
    ]);
    expect(await planDueReminders(db, NOW)).toEqual([]);
  });

  it('nudges streaks at risk at the chosen time', async () => {
    const u = await player('cai', { streakNudgeAt: '18:00' });
    const wordle = await gameId('wordle');
    await db.insert(follows).values({ userId: u.id, gameId: wordle.id });
    const today = currentPuzzle(clockFromGame(wordle), NOW, u.timezone).number;
    await db.insert(streaks).values({
      userId: u.id,
      gameId: wordle.id,
      current: 9,
      best: 9,
      lastPuzzleNumber: today - 1,
    });
    const [p] = await planDueReminders(db, NOW);
    expect(p!.notification.title).toBe('Your 9-day Wordle streak is at risk');
    expect(p!.key).toBe('streak:2026-10-17');
  });

  it('prunes old delivery records', async () => {
    const u = await player('dee');
    await db.insert(reminderDeliveries).values([
      { userId: u.id, key: 'old', createdAt: new Date(NOW.getTime() - 20 * 86_400_000) },
      { userId: u.id, key: 'new', createdAt: NOW },
    ]);
    await pruneDeliveries(db, NOW);
    expect((await db.select().from(reminderDeliveries)).map((r) => r.key)).toEqual(['new']);
  });
});
