import { z } from 'zod';
import { assertCanModerate, communityOfReport, dismissReport } from '@/server/community';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireSession();
    await enforceLimit('admin-edit', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Not found.');
    await assertCanModerate(user, await communityOfReport(id));
    await dismissReport(user.id, id);
    return { ok: true };
  })(req);
}
