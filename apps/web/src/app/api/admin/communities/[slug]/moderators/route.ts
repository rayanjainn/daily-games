import { addBoardModerator, ensureCommunity, moderatorInputSchema } from '@/server/community';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';

type Ctx = { params: Promise<{ slug: string }> };

/** Appoints a community moderator. Site moderators only. */
export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return mutation(moderatorInputSchema, async ({ username }) => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    const c = await ensureCommunity(slug);
    if (!c) throw new HttpError(404, 'not_found', 'Community not found.');
    await addBoardModerator(user.id, c.community.id, username);
    return { ok: true };
  })(req);
}
