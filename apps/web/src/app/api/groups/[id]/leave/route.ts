import { z } from 'zod';
import { leaveGroup } from '@/server/groups';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireSession();
    await enforceLimit('group-edit', user.id);
    await leaveGroup(user.id, id);
    return { ok: true };
  })(req);
}
