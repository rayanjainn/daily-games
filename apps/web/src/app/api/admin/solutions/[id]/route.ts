import { z } from 'zod';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';
import { decideSolution, solutionDecisionSchema } from '@/server/solutions';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(solutionDecisionSchema, async (d) => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Solution not found.');
    await decideSolution(user.id, id, d);
    return { ok: true };
  })(req);
}
