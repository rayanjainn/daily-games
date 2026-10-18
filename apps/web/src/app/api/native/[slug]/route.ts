import { getGameBySlug } from '@/server/catalog';
import { announceResultChange } from '@/server/groups';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { moveSchema, nativeMove } from '@/server/native';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ slug: string }> };

/** One move in today's puzzle of a native game; the answer never leaves the server. */
export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return mutation(moveSchema, async (move) => {
    const { user } = await requireSession();
    await enforceLimit('native-move', user.id);
    const game = await getGameBySlug(slug);
    if (!game || game.status === 'archived' || game.embedMode !== 'native')
      throw new HttpError(404, 'not_found', 'Game not found.');
    const view = await nativeMove(user, game, move);
    if (view.finished) await announceResultChange(user.id);
    return view;
  })(req);
}
