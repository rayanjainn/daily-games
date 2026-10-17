import { z } from 'zod';
import { and, eq, follows, games, max, ne } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ gameId: string }> };
const uuid = z.string().uuid();
const empty = z.object({}).strict();

/** Follow a game; new follows go to the end of the player's checklist. Idempotent. */
export async function POST(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  return mutation(empty, async () => {
    const { user } = await requireSession();
    await enforceLimit('follow', user.id);
    if (!uuid.safeParse(gameId).success) throw new HttpError(404, 'not_found', 'Game not found.');
    const game = await db()
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.id, gameId), ne(games.status, 'archived')))
      .limit(1);
    if (!game.length) throw new HttpError(404, 'not_found', 'Game not found.');
    const [{ last }] = (await db()
      .select({ last: max(follows.position) })
      .from(follows)
      .where(eq(follows.userId, user.id))) as [{ last: number | null }];
    await db()
      .insert(follows)
      .values({ userId: user.id, gameId, position: (last ?? -1) + 1 })
      .onConflictDoNothing();
    return { following: true };
  })(req);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  return mutation(empty, async () => {
    const { user } = await requireSession();
    await enforceLimit('follow', user.id);
    if (!uuid.safeParse(gameId).success) throw new HttpError(404, 'not_found', 'Game not found.');
    await db()
      .delete(follows)
      .where(and(eq(follows.userId, user.id), eq(follows.gameId, gameId)));
    return { following: false };
  })(req);
}
