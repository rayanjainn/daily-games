import { z } from 'zod';
import { and, eq, games, ne } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { noteInputSchema, saveNote } from '@/server/notes';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ gameId: string }> };

/** Replaces the signed-in player's private note for one game. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  return mutation(noteInputSchema, async ({ body }) => {
    const { user } = await requireSession();
    await enforceLimit('note-save', user.id);
    if (!z.string().uuid().safeParse(gameId).success)
      throw new HttpError(404, 'not_found', 'Game not found.');
    const game = await db()
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.id, gameId), ne(games.status, 'archived')))
      .limit(1);
    if (!game.length) throw new HttpError(404, 'not_found', 'Game not found.');
    return saveNote(user.id, gameId, body);
  })(req);
}
