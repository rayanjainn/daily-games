import { z } from 'zod';
import { createGroup, groupNameSchema } from '@/server/groups';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

/** Creates a group with the caller as owner. */
export const POST = mutation(z.object({ name: groupNameSchema }).strict(), async ({ name }) => {
  const { user } = await requireSession();
  await enforceLimit('group-create', user.id);
  return createGroup(user.id, name);
});
