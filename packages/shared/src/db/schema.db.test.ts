import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, truncateAll } from '../test/db';
import {
  follows,
  games,
  modActions,
  passkeyCredentials,
  results,
  sessions,
  users,
  type NewGame,
} from './schema';

const { db, client } = testDb();
afterAll(() => client.end());
beforeEach(() => truncateAll(db));

const game = (over: Partial<NewGame> = {}): NewGame => ({
  slug: 'wordle',
  name: 'Wordle',
  publisher: 'The New York Times',
  description: 'Guess the five-letter word in six tries.',
  url: 'https://www.nytimes.com/games/wordle/index.html',
  category: 'word',
  difficulty: 'medium',
  tier: 1,
  resetMode: 'user_local',
  puzzleEpoch: '2021-06-19',
  epochNumber: 0,
  parserId: 'wordle',
  scoringType: 'attempts',
  maxAttempts: 6,
  accentColor: '#6AAA64',
  icon: 'grid',
  attributionNote: 'Made by The New York Times.',
  ...over,
});

async function makeUser(username = 'brave_otter') {
  const [u] = await db.insert(users).values({ username }).returning();
  return u!;
}

/** Postgres error code from a failed query (drizzle wraps the driver error in `cause`). */
async function pgCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.cause?.code ?? err.code;
  }
  return undefined;
}

describe('users', () => {
  it('generates time-ordered uuid v7 ids', async () => {
    const u = await makeUser();
    expect(u.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it('treats usernames case-insensitively for uniqueness', async () => {
    await makeUser('brave_otter');
    // citext unique index: an uppercase variant collides even though the format check would
    // reject it anyway; insert via raw SQL to bypass the format check ordering.
    expect(
      await pgCode(
        db.execute(sql`INSERT INTO users (id, username) VALUES (gen_random_uuid(), 'BRAVE_OTTER')`),
      ),
    ).toMatch(/^(23505|23514)$/);
    expect(await pgCode(db.insert(users).values({ username: 'brave_otter' }))).toBe('23505');
  });

  it('enforces the username format (lowercase, 3–20, [a-z0-9_])', async () => {
    for (const bad of ['ab', 'UPPER', 'has space', 'a'.repeat(21), 'dash-name', 'émile']) {
      expect(await pgCode(db.insert(users).values({ username: bad })), bad).toBe('23514');
    }
  });

  it('allows many users without email but keeps emails unique', async () => {
    await db.insert(users).values([{ username: 'one_user' }, { username: 'two_user' }]);
    await db.insert(users).values({ username: 'three', email: 'a@example.com' });
    expect(
      await pgCode(db.insert(users).values({ username: 'four', email: 'A@Example.com' })),
    ).toBe('23505');
  });

  it('cascades account deletion to credentials, sessions, follows and results', async () => {
    const u = await makeUser();
    const [g] = await db.insert(games).values(game()).returning();
    await db.insert(passkeyCredentials).values({
      userId: u.id,
      credentialId: 'cred-1',
      publicKey: new Uint8Array([1, 2, 3]),
      deviceType: 'multiDevice',
      nickname: 'Phone',
    });
    await db.insert(sessions).values({
      userId: u.id,
      tokenHash: 'h',
      expiresAt: new Date(Date.now() + 1e6),
      method: 'passkey',
    });
    await db.insert(follows).values({ userId: u.id, gameId: g!.id });
    await db.insert(results).values({
      userId: u.id,
      gameId: g!.id,
      puzzleNumber: 1,
      puzzleDate: '2021-06-20',
      solved: true,
      attempts: 4,
      source: 'paste',
    });
    await db.delete(users).where(eq(users.id, u.id));
    for (const t of [passkeyCredentials, sessions, follows, results]) {
      expect(await db.select().from(t)).toHaveLength(0);
    }
  });

  it('round-trips binary public keys', async () => {
    const u = await makeUser();
    const key = new Uint8Array([0, 255, 128, 7, 42]);
    await db.insert(passkeyCredentials).values({
      userId: u.id,
      credentialId: 'c',
      publicKey: key,
      deviceType: 'singleDevice',
      nickname: 'Key',
    });
    const [row] = await db.select().from(passkeyCredentials);
    expect(Array.from(row!.publicKey)).toEqual(Array.from(key));
  });
});

describe('games', () => {
  it('rejects an iframe embed mode without a passing probe', async () => {
    expect(await pgCode(db.insert(games).values(game({ embedMode: 'iframe' })))).toBe('23514');
    await db.insert(games).values(game({ embedMode: 'iframe', verifiedEmbeddableAt: new Date() }));
  });

  it('requires a timezone for fixed resets', async () => {
    expect(await pgCode(db.insert(games).values(game({ resetMode: 'fixed', resetTz: null })))).toBe(
      '23514',
    );
  });

  it('rejects unknown categories, tiers and statuses', async () => {
    expect(await pgCode(db.insert(games).values(game({ category: 'sports' as never })))).toBe(
      '23514',
    );
    expect(await pgCode(db.insert(games).values(game({ tier: 4 as never })))).toBe('23514');
    expect(await pgCode(db.insert(games).values(game({ status: 'gone' as never })))).toBe('23514');
  });
});

describe('results', () => {
  it('allows one result per user, game and puzzle', async () => {
    const u = await makeUser();
    const [g] = await db.insert(games).values(game()).returning();
    const row = {
      userId: u.id,
      gameId: g!.id,
      puzzleNumber: 1500,
      puzzleDate: '2025-07-27',
      solved: true,
      attempts: 3,
      source: 'paste' as const,
    };
    await db.insert(results).values(row);
    expect(await pgCode(db.insert(results).values(row))).toBe('23505');
  });

  it('caps stored share text at 4096 characters', async () => {
    const u = await makeUser();
    const [g] = await db.insert(games).values(game()).returning();
    const base = {
      userId: u.id,
      gameId: g!.id,
      puzzleDate: '2025-07-27',
      solved: true,
      source: 'paste' as const,
    };
    await db.insert(results).values({ ...base, puzzleNumber: 1, rawShareText: 'x'.repeat(4096) });
    expect(
      await pgCode(
        db.insert(results).values({ ...base, puzzleNumber: 2, rawShareText: 'x'.repeat(4097) }),
      ),
    ).toBe('23514');
  });
});

describe('mod_actions', () => {
  it('is append-only', async () => {
    const u = await makeUser('mod_user');
    const [a] = await db
      .insert(modActions)
      .values({ actorId: u.id, action: 'game.update', targetType: 'game', targetId: 'x' })
      .returning();
    expect(
      await pgCode(db.update(modActions).set({ reason: 'edited' }).where(eq(modActions.id, a!.id))),
    ).toBe('P0001');
    expect(await pgCode(db.delete(modActions).where(eq(modActions.id, a!.id)))).toBe('P0001');
  });

  it('still lets the actor account be deleted (actor becomes null)', async () => {
    const u = await makeUser('mod_user');
    await db
      .insert(modActions)
      .values({ actorId: u.id, action: 'game.update', targetType: 'game', targetId: 'x' });
    await db.delete(users).where(eq(users.id, u.id));
    const [row] = await db.select().from(modActions);
    expect(row!.actorId).toBeNull();
    expect(row!.action).toBe('game.update');
  });
});
