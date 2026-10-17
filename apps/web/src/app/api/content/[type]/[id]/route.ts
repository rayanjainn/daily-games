import { z } from 'zod';
import { deleteOwn } from '@/server/community';
import { target } from '@/server/community-route';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ type: string; id: string }> };

/** Authors delete their own post or comment. */
export async function DELETE(req: Request, ctx: Ctx) {
  const p = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireSession();
    await enforceLimit('comment-create', user.id);
    const t = target(p.type, p.id);
    await deleteOwn(user.id, t.type, t.id);
    return { ok: true };
  })(req);
}
