import { z } from 'zod';
import { deleteGroup, groupNameSchema, regenerateInvite, renameGroup } from '@/server/groups';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

type Ctx = { params: Promise<{ id: string }> };

const edit = z.union([
  z.object({ name: groupNameSchema }).strict(),
  z.object({ regenerateInvite: z.literal(true) }).strict(),
]);

/** Rename (owner or admin) or replace the invite link, which stops old links working. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(edit, async (body) => {
    const { user } = await requireSession();
    await enforceLimit('group-edit', user.id);
    if ('name' in body) {
      await renameGroup(user.id, id, body.name);
      return { ok: true };
    }
    return regenerateInvite(user.id, id);
  })(req);
}

/** Deletes the group for everyone (owner only). */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return mutation(z.object({}).strict(), async () => {
    const { user } = await requireSession();
    await enforceLimit('group-edit', user.id);
    await deleteGroup(user.id, id);
    return { ok: true };
  })(req);
}
