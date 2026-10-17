import { gameEditSchema } from '@everydaily/shared/catalog/rules';
import { updateGame } from '@/server/catalog/moderation';
import { enforceLimit, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';

type Ctx = { params: Promise<{ slug: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return mutation(gameEditSchema, async (edit) => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    return updateGame(user.id, slug, edit);
  })(req);
}
