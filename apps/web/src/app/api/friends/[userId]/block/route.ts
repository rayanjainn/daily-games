import { z } from 'zod';
import { block } from '@/server/friends';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ userId: string }> };

/** Blocks this player; they can no longer find or request you. */
export async function POST(req: Request, ctx: Ctx) {
  const { userId } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireSession();
    await enforceLimit('friend-edit', user.id);
    if (!z.string().uuid().safeParse(userId).success)
      throw new HttpError(404, 'not_found', 'No such player.');
    await block(user.id, userId);
    return { ok: true };
  })(req);
}
