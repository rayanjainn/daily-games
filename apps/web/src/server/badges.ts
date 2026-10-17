import 'server-only';
import { eq, results } from '@everydaily/shared/db';
import { computeBadges } from '@everydaily/shared/stats/badges';
import { db } from './db';

/** The player's badges, worked out from all of their results each time (nothing is stored). */
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
