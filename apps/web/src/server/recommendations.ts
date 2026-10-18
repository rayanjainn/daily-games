import 'server-only';
import {
  and,
  count,
  eq,
  follows,
  friendships,
  inArray,
  or,
  pickDismissals,
} from '@everydaily/shared/db';
import { recommend, type PickReason } from '@everydaily/shared/catalog/recommend';
import { listGames, toCatalogGame, type CatalogGame } from './catalog';
import { db } from './db';

export interface GamePick {
  game: CatalogGame;
  reason: PickReason;
}

/** Games the player doesn't follow yet (and hasn't dismissed) that they may like (see `recommend`). */
export async function picksFor(
  user: { id: string; timezone: string },
  limit = 4,
): Promise<GamePick[]> {
  const [all, mine, dismissed, popularity, links] = await Promise.all([
    listGames(),
    db().select({ gameId: follows.gameId }).from(follows).where(eq(follows.userId, user.id)),
    db()
      .select({ gameId: pickDismissals.gameId })
      .from(pickDismissals)
      .where(eq(pickDismissals.userId, user.id)),
    db().select({ gameId: follows.gameId, n: count() }).from(follows).groupBy(follows.gameId),
    db()
      .select({ a: friendships.userA, b: friendships.userB })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(eq(friendships.userA, user.id), eq(friendships.userB, user.id)),
        ),
      ),
  ]);
  const friendIds = links.map((l) => (l.a === user.id ? l.b : l.a));
  const byFriends = friendIds.length
    ? await db()
        .select({ gameId: follows.gameId, n: count() })
        .from(follows)
        .where(inArray(follows.userId, friendIds))
        .groupBy(follows.gameId)
    : [];

  const followed = new Set(mine.map((m) => m.gameId));
  const skipped = new Set(dismissed.map((d) => d.gameId));
  const followers = new Map(popularity.map((p) => [p.gameId, p.n]));
  const friendCount = new Map(byFriends.map((p) => [p.gameId, p.n]));
  const picks = recommend(
    all
      .filter((g) => !followed.has(g.id) && !skipped.has(g.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        category: g.category,
        followers: followers.get(g.id) ?? 0,
        friendFollowers: friendCount.get(g.id) ?? 0,
      })),
    all.filter((g) => followed.has(g.id)).map((g) => g.category),
    limit,
  );
  const now = new Date();
  const byId = new Map(all.map((g) => [g.id, g]));
  return picks.map((p) => ({
    game: toCatalogGame(byId.get(p.id)!, user.timezone, now),
    reason: p.reason,
  }));
}
