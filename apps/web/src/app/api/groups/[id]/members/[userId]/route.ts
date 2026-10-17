import { z } from 'zod';
import { removeMember } from '@/server/groups';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ id: string; userId: string }> };

/** Removes a member (owner or admin). */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id, userId } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireSession();
    await enforceLimit('group-edit', user.id);
    if (!z.string().uuid().safeParse(userId).success)
      throw new HttpError(404, 'not_found', 'No such member.');
    await removeMember(user.id, id, userId);
    return { ok: true };
  })(req);
}
