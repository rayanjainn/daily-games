import { z } from 'zod';
import { dismissReport } from '@/server/community';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Not found.');
    await dismissReport(user.id, id);
    return { ok: true };
  })(req);
}
