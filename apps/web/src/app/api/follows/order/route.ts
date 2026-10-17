import { z } from 'zod';
import { and, eq, follows } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

/** Reorders the checklist. The list must be exactly the games the player follows. */
export const PATCH = mutation(
  z.object({ gameIds: z.array(z.string().uuid()).max(200) }).strict(),
  async ({ gameIds }) => {
    const { user } = await requireSession();
    await enforceLimit('follow', user.id);
    await db().transaction(async (tx) => {
      const current = await tx
        .select({ gameId: follows.gameId })
        .from(follows)
        .where(eq(follows.userId, user.id))
        .for('update');
      const have = new Set(current.map((c) => c.gameId));
      if (
        new Set(gameIds).size !== gameIds.length ||
        gameIds.length !== have.size ||
        gameIds.some((id) => !have.has(id))
      )
        throw new HttpError(409, 'stale_order', 'Your list changed. Reload and try again.');
      for (const [position, gameId] of gameIds.entries()) {
        await tx
          .update(follows)
          .set({ position })
          .where(and(eq(follows.userId, user.id), eq(follows.gameId, gameId)));
      }
    });
    return { ok: true };
  },
);
