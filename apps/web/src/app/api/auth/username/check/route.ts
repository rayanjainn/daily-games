import { z } from 'zod';
import { enforceLimit, mutation } from '@/server/http';
import { clientIp } from '@/server/request';
import { usernameAvailability } from '@/server/auth/accounts';

export const POST = mutation(z.object({ username: z.string().max(64) }), async ({ username }) => {
  await enforceLimit('username-check', await clientIp());
  return usernameAvailability(username);
});
