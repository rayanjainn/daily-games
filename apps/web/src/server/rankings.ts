import 'server-only';
import { and, eq, games, gte, isNull, results, users } from '@everydaily/shared/db';
import { rankPlayers, type RankedPlayer } from '@everydaily/shared/stats/rankings';
import { addDays } from '@everydaily/shared/time/zoned';
import { db } from './db';

export type RankingScope = 'verified' | 'all';

export interface RankingRow extends RankedPlayer {
  me: boolean;
}

const TOP = 25;

/**
 * The last seven days of combined points across players.
 *
 * - `verified`: only results the server saw being played (native games), which can't be typed in.
 * - `all`: every result, including pasted and typed-in ones, so it is self-reported.
 *
 * Players who hid themselves in Settings are left out, except to themselves.
 */
export async function rankings(viewerId: string, scope: RankingScope, now = new Date()) {
  const since = addDays(now.toISOString().slice(0, 10), -6);
  const rows = await db()
    .select({
      userId: results.userId,
      name: users.displayName,
      username: users.username,
      listed: users.showOnRankings,
      scoring: games.scoringType,
      solved: results.solved,
      attempts: results.attempts,
      maxAttempts: results.maxAttempts,
      fromArchive: results.fromArchive,
    })
    .from(results)
    .innerJoin(users, eq(users.id, results.userId))
    .innerJoin(games, eq(games.id, results.gameId))
    .where(
      and(
        gte(results.puzzleDate, since),
        isNull(users.deletedAt),
        scope === 'verified' ? eq(results.source, 'native') : undefined,
      ),
    );
  const ranked = rankPlayers(
    rows
      .filter((r) => r.listed || r.userId === viewerId)
      .map((r) => ({ ...r, name: r.name ?? r.username })),
  );
  const top = ranked.slice(0, TOP);
  const mine = ranked.find((p) => p.userId === viewerId);
  const shown = mine && !top.includes(mine) ? [...top, mine] : top;
  return {
    players: ranked.length,
    rows: shown.map((p): RankingRow => ({ ...p, me: p.userId === viewerId })),
  };
}
