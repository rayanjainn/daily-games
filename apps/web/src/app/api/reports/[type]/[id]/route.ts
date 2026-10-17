import { report, reportInputSchema } from '@/server/community';
import { target } from '@/server/community-route';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ type: string; id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const p = await ctx.params;
  return mutation(reportInputSchema, async ({ reason }) => {
    const { user } = await requireSession();
    await enforceLimit('content-report', user.id);
    const t = target(p.type, p.id);
    await report(user.id, t.type, t.id, reason);
    return { ok: true };
  })(req);
}
