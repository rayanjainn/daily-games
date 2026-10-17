import { z } from 'zod';
import { decideSubmission, submissionDecisionSchema } from '@/server/catalog/moderation';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(submissionDecisionSchema, async (d) => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Submission not found.');
    return decideSubmission(user.id, id, d);
  })(req);
}
