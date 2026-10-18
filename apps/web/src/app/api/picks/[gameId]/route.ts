import { z } from 'zod';
import { and, eq, games, ne, pickDismissals } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ gameId: string }> };
const uuid = z.string().uuid();
const empty = z.object({}).strict();

/** "Not interested": stop suggesting this game to the player. Idempotent. */
export async function POST(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  return mutation(empty, async () => {
    const { user } = await requireSession();
    await enforceLimit('follow', user.id);
    if (!uuid.safeParse(gameId).success) throw new HttpError(404, 'not_found', 'Game not found.');
    const [game] = await db()
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.id, gameId), ne(games.status, 'archived')))
      .limit(1);
    if (!game) throw new HttpError(404, 'not_found', 'Game not found.');
    await db().insert(pickDismissals).values({ userId: user.id, gameId }).onConflictDoNothing();
    return { dismissed: true };
  })(req);
}
