import 'server-only';
import { eq, results, users } from '@everydaily/shared/db';
import { computeBadges, levelsOf, newBadgeLevels } from '@everydaily/shared/stats/badges';
import { db } from './db';

/** The player's badges, worked out from all of their results each time. */
export async function getBadges(userId: string) {
  const rows = await db()
    .select({
      gameId: results.gameId,
      puzzleNumber: results.puzzleNumber,
      puzzleDate: results.puzzleDate,
      solved: results.solved,
      fromArchive: results.fromArchive,
    })
    .from(results)
    .where(eq(results.userId, userId));
  return computeBadges(rows);
}

/**
 * Badges plus what's new since the player last saw them. The first visit only records where they
 * stand, so existing players aren't told about everything at once.
 */
export async function badgesWithNews(user: {
  id: string;
  badgesSeen: Record<string, number> | null;
}) {
  const badges = await getBadges(user.id);
  if (user.badgesSeen === null) {
    await db()
      .update(users)
      .set({ badgesSeen: levelsOf(badges) })
      .where(eq(users.id, user.id));
    return { badges, seen: levelsOf(badges), news: [] };
  }
  return { badges, seen: user.badgesSeen, news: newBadgeLevels(badges, user.badgesSeen) };
}

/** Marks every badge level reached so far as announced. */
export async function markBadgesSeen(userId: string) {
  const badges = await getBadges(userId);
  await db()
    .update(users)
    .set({ badgesSeen: levelsOf(badges) })
    .where(eq(users.id, userId));
}
