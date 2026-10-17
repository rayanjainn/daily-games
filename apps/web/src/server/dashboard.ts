import 'server-only';
import { and, asc, eq, follows, games, gte, inArray, ne, results } from '@everydaily/shared/db';
import { clockFromGame } from '@everydaily/shared/registry';
import { formatResult } from '@everydaily/shared/stats/format';
import { computeStreak, dayIndex, type Streak } from '@everydaily/shared/stats/streak';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { addDays, localDate } from '@everydaily/shared/time/zoned';
import { toCatalogGame, type CatalogGame } from './catalog';
import { db } from './db';

/** How far back streaks look. Longer streaks show as "400+" until the stats cache lands. */
const LOOKBACK_DAYS = 400;

export interface ChecklistItem {
  game: CatalogGame;
  /** today's puzzle index for this player (internal number, even when the game shows none) */
  puzzleNumber: number;
  done: { summary: string; solved: boolean } | null;
  streak: Streak;
}

export interface Dashboard {
  today: string;
  items: ChecklistItem[];
  done: number;
  combined: Streak;
}

/**
 * Today's checklist: followed games in the player's order, today's puzzle for each under its
 * reset rule, whether it is logged, and per-game plus combined streaks.
 */
export async function getDashboard(
  user: { id: string; timezone: string },
  now = new Date(),
): Promise<Dashboard> {
  const today = localDate(now, user.timezone);
  const rows = await db()
    .select({ game: games })
    .from(follows)
    .innerJoin(games, eq(games.id, follows.gameId))
    .where(and(eq(follows.userId, user.id), ne(games.status, 'archived')))
    .orderBy(asc(follows.position), asc(games.name));

  const gameIds = rows.map((r) => r.game.id);
  const since = addDays(today, -LOOKBACK_DAYS);
  const recent = gameIds.length
    ? await db()
        .select({
          gameId: results.gameId,
          puzzleNumber: results.puzzleNumber,
          puzzleDate: results.puzzleDate,
          solved: results.solved,
          attempts: results.attempts,
          maxAttempts: results.maxAttempts,
          timeSeconds: results.timeSeconds,
          score: results.score,
        })
        .from(results)
        .where(and(eq(results.userId, user.id), gte(results.puzzleDate, since)))
    : [];

  const byGame = new Map<string, typeof recent>();
  for (const r of recent) {
    const list = byGame.get(r.gameId) ?? [];
    list.push(r);
    byGame.set(r.gameId, list);
  }

  const items: ChecklistItem[] = rows.map(({ game }) => {
    const clock = clockFromGame(game);
    const p = currentPuzzle(clock, now, user.timezone);
    const mine = byGame.get(game.id) ?? [];
    const todays = mine.find((r) => r.puzzleNumber === p.number);
    return {
      game: toCatalogGame(game, user.timezone, now),
      puzzleNumber: p.number,
      done: todays
        ? {
            summary: formatResult(todays, { type: game.scoringType, unit: game.scoringUnit }),
            solved: todays.solved,
          }
        : null,
      streak: computeStreak(
        mine.map((r) => r.puzzleNumber),
        p.number,
      ),
    };
  });

  // Combined: days (by puzzle date) on which the player logged any daily puzzle at all.
  const combined = computeStreak(
    recent.map((r) => dayIndex(r.puzzleDate)),
    dayIndex(today),
  );

  return { today, items, done: items.filter((i) => i.done).length, combined };
}

/** Games new players usually start with, for the empty dashboard. */
export async function starterGames(userTz: string): Promise<CatalogGame[]> {
  const picks = ['wordle', 'connections', 'strands', 'nyt-mini'];
  const rows = await db().select().from(games).where(inArray(games.slug, picks));
  return picks
    .map((s) => rows.find((g) => g.slug === s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g && g.status !== 'archived'))
    .map((g) => toCatalogGame(g, userTz));
}
