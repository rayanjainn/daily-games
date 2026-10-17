/**
 * Demo data: follows and about four months of results, so the dashboard and stats look lived-in.
 *
 *   DATABASE_URL=... pnpm seed:demo --for <username>   add history to your own (local) account
 *   DATABASE_URL=... pnpm seed:demo                    create demo_ava, demo_ben and demo_cai
 *
 * Demo players have no passkey, so nobody can sign in as them; they only populate data.
 * Existing results are never overwritten. Run `pnpm seed:games` first.
 */
import { randomUUID } from 'node:crypto';
import {
  createDb,
  eq,
  follows,
  games,
  inArray,
  results,
  users,
  type Game,
  type NewResult,
} from '@everydaily/shared/db';
import { clockFromGame } from '@everydaily/shared/registry';
import { currentPuzzle, dateForPuzzleNumber } from '@everydaily/shared/time/puzzle';

const DAYS = 120;
const LINEUP = ['wordle', 'connections', 'strands', 'nyt-mini', 'globle', 'quordle', 'tradle'];

/** Small deterministic PRNG (mulberry32) so a seed run is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resultFor(
  game: Game,
  rand: () => number,
): Omit<NewResult, 'userId' | 'gameId' | 'puzzleNumber' | 'puzzleDate'> {
  const solved = rand() > 0.12;
  switch (game.scoringType) {
    case 'attempts': {
      const max = game.maxAttempts ?? 6;
      const weights = [0.02, 0.1, 0.3, 0.33, 0.17, 0.08].slice(0, max);
      let r = rand() * weights.reduce((a, b) => a + b, 0);
      let attempts = 1;
      for (const [i, w] of weights.entries()) {
        if ((r -= w) <= 0) {
          attempts = i + 1;
          break;
        }
      }
      return { solved, attempts: solved ? attempts : null, maxAttempts: max, source: 'paste' };
    }
    case 'time':
      return { solved: true, timeSeconds: Math.round(25 + rand() * rand() * 180), source: 'paste' };
    case 'points':
    case 'distance':
      return { solved, score: Math.round(rand() * 900 + 100), source: 'manual' };
    case 'completion':
      return { solved: true, source: 'checkbox' };
  }
}

async function seedPlayer(
  db: ReturnType<typeof createDb>['db'],
  user: { id: string; timezone: string },
  lineup: Game[],
  seed: number,
) {
  const rand = rng(seed);
  await db
    .insert(follows)
    .values(lineup.map((g, position) => ({ userId: user.id, gameId: g.id, position })))
    .onConflictDoNothing();
  const rows: NewResult[] = [];
  const now = new Date();
  for (const game of lineup) {
    const clock = clockFromGame(game);
    const today = currentPuzzle(clock, now, user.timezone).number;
    // Each player skips some days and some games; today is left for them to log.
    const playRate = 0.6 + rand() * 0.35;
    for (let d = 1; d <= DAYS; d++) {
      const n = today - d;
      if (n < game.epochNumber || rand() > playRate) continue;
      rows.push({
        userId: user.id,
        gameId: game.id,
        puzzleNumber: n,
        puzzleDate: dateForPuzzleNumber(clock, n),
        ...resultFor(game, rand),
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(results)
      .values(rows.slice(i, i + 500))
      .onConflictDoNothing();
  }
  return rows.length;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const args = process.argv.slice(2);
const forUser = args.includes('--for') ? args[args.indexOf('--for') + 1] : null;

const { db, client } = createDb(url, { max: 2 });
try {
  const lineup = await db.select().from(games).where(inArray(games.slug, LINEUP));
  if (!lineup.length) throw new Error('No games found. Run `pnpm seed:games` first.');
  const ordered = LINEUP.map((s) => lineup.find((g) => g.slug === s)).filter((g): g is Game =>
    Boolean(g),
  );

  if (forUser) {
    const [user] = await db.select().from(users).where(eq(users.username, forUser.toLowerCase()));
    if (!user) throw new Error(`No user called "${forUser}". Sign up first, then run this again.`);
    const n = await seedPlayer(db, user, ordered, 7);
    console.log(`Added up to ${n} results and ${ordered.length} follows for ${user.username}.`);
  } else {
    for (const [i, name] of ['demo_ava', 'demo_ben', 'demo_cai'].entries()) {
      const [user] = await db
        .insert(users)
        .values({
          id: randomUUID(),
          username: name,
          timezone: ['UTC', 'America/New_York', 'Asia/Kolkata'][i]!,
        })
        .onConflictDoUpdate({ target: users.username, set: { updatedAt: new Date() } })
        .returning({ id: users.id, timezone: users.timezone, username: users.username });
      const n = await seedPlayer(db, user!, ordered.slice(0, 4 + i), 100 + i);
      console.log(`${user!.username}: ${n} results`);
    }
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
