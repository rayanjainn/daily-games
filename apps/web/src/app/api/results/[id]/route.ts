import { z } from 'zod';
import { and, eq, games, results } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { announceResultChange } from '@/server/groups';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { refreshStreak } from '@/server/results';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ id: string }> };

/** Removes one of the player's own results (undo, or to log it again correctly). */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireSession();
    await enforceLimit('result-log', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Result not found.');
    const deleted = await db()
      .delete(results)
      .where(and(eq(results.id, id), eq(results.userId, user.id)))
      .returning({ gameId: results.gameId });
    if (!deleted.length) throw new HttpError(404, 'not_found', 'Result not found.');
    const [game] = await db().select().from(games).where(eq(games.id, deleted[0]!.gameId));
    if (game) await refreshStreak(user.id, game, user.timezone);
    await announceResultChange(user.id);
    return { ok: true };
  })(req);
}
