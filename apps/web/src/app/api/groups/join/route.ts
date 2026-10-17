import { z } from 'zod';
import { joinByCode } from '@/server/groups';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

export const POST = mutation(z.object({ code: z.string().max(40) }).strict(), async ({ code }) => {
  const { user } = await requireSession();
  await enforceLimit('group-join', user.id);
  return joinByCode(user.id, code);
});
