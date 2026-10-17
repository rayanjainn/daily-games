import { z } from 'zod';
import { and, eq, gameReports } from '@everydaily/shared/db';
import { getGameBySlug } from '@/server/catalog';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ slug: string }> };

/** Players can't file the worker's automatic `auto` kind. */
const schema = z
  .object({
    kind: z.enum(['wrong_reset', 'moved', 'dead', 'wrong_info', 'other']),
    details: z.string().trim().max(1000).optional(),
  })
  .strict();

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return mutation(schema, async ({ kind, details }) => {
    const { user } = await requireSession();
    await enforceLimit('game-report', user.id);
    const game = await getGameBySlug(slug);
    if (!game || game.status === 'archived')
      throw new HttpError(404, 'not_found', 'Game not found.');
    if (kind === 'other' && !details)
      throw new HttpError(400, 'invalid_input', 'Tell us a little about the problem.');

    // One open report per player, game and kind is enough for the mod queue.
    const open = await db()
      .select({ id: gameReports.id })
      .from(gameReports)
      .where(
        and(
          eq(gameReports.gameId, game.id),
          eq(gameReports.userId, user.id),
          eq(gameReports.kind, kind),
          eq(gameReports.status, 'open'),
        ),
      )
      .limit(1);
    if (open.length) return { ok: true, duplicate: true };

    await db()
      .insert(gameReports)
      .values({ gameId: game.id, userId: user.id, kind, details: details || null });
    return { ok: true, duplicate: false };
  })(req);
}
