import { modInputSchema, moderate } from '@/server/community';
import { target } from '@/server/community-route';
import { enforceLimit, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';

type Ctx = { params: Promise<{ type: string; id: string }> };

/** Remove, restore, lock or unlock (moderators; audit-logged). */
export async function POST(req: Request, ctx: Ctx) {
  const p = await ctx.params;
  return mutation(modInputSchema, async (input) => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    const t = target(p.type, p.id);
    await moderate(user.id, t.type, t.id, input);
    return { ok: true };
  })(req);
}
