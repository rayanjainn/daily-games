import { z } from 'zod';
import { and, eq, follows } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { clockTime } from '@/server/reminders';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ gameId: string }> };

/** Sets (or clears, with null) the daily reminder time for one followed game. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  return mutation(z.object({ remindAt: clockTime.nullable() }).strict(), async ({ remindAt }) => {
    const { user } = await requireSession();
    await enforceLimit('reminder-edit', user.id);
    if (!z.string().uuid().safeParse(gameId).success)
      throw new HttpError(404, 'not_found', 'Game not found.');
    const updated = await db()
      .update(follows)
      .set({ remindAt })
      .where(and(eq(follows.userId, user.id), eq(follows.gameId, gameId)))
      .returning({ gameId: follows.gameId });
    if (!updated.length)
      throw new HttpError(404, 'not_following', 'Follow the game first to get reminders.');
    return { remindAt };
  })(req);
}
