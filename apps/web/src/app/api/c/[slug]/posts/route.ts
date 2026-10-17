import { createPost, ensureCommunity, postInputSchema } from '@/server/community';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return mutation(postInputSchema, async (input) => {
    const { user } = await requireSession();
    await enforceLimit('post-create', user.id);
    const c = await ensureCommunity(slug);
    if (!c) throw new HttpError(404, 'not_found', 'Community not found.');
    return createPost(user, c.community, input);
  })(req);
}
