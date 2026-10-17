import { vote, voteInputSchema } from '@/server/community';
import { target } from '@/server/community-route';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ type: string; id: string }> };

/** Up (1), down (-1) or clear (0) the viewer's vote. */
export async function POST(req: Request, ctx: Ctx) {
  const p = await ctx.params;
  return mutation(voteInputSchema, async ({ value }) => {
    const { user } = await requireSession();
    await enforceLimit('vote', user.id);
    const t = target(p.type, p.id);
    return vote(user.id, t.type, t.id, value);
  })(req);
}
