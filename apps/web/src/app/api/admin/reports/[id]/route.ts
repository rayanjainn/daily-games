import { z } from 'zod';
import { decideReport, reportDecisionSchema } from '@/server/catalog/moderation';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(reportDecisionSchema, async (d) => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Report not found.');
    await decideReport(user.id, id, d);
    return { ok: true };
  })(req);
}
