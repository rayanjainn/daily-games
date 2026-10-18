import {
  assertCanModerate,
  createFlair,
  ensureCommunity,
  flairInputSchema,
} from '@/server/community';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return mutation(flairInputSchema, async (input) => {
    const { user } = await requireSession();
    await enforceLimit('admin-edit', user.id);
    const c = await ensureCommunity(slug);
    if (!c) throw new HttpError(404, 'not_found', 'Community not found.');
    await assertCanModerate(user, c.community.id);
    return createFlair(user.id, c.community.id, input);
  })(req);
}
