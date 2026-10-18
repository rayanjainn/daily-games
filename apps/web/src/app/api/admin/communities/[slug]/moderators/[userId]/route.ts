import { z } from 'zod';
import { ensureCommunity, removeBoardModerator } from '@/server/community';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireRole } from '@/server/roles';

type Ctx = { params: Promise<{ slug: string; userId: string }> };

/** Removes a community moderator. Site moderators only. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { slug, userId } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireRole('mod');
    await enforceLimit('admin-edit', user.id);
    if (!z.string().uuid().safeParse(userId).success)
      throw new HttpError(404, 'not_found', 'Not found.');
    const c = await ensureCommunity(slug);
    if (!c) throw new HttpError(404, 'not_found', 'Community not found.');
    await removeBoardModerator(user.id, c.community.id, userId);
    return { ok: true };
  })(req);
}
