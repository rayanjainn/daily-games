import { z } from 'zod';
import { enforceLimit, mutation } from '@/server/http';
import { clientIp } from '@/server/request';
import { authenticationOptions } from '@/server/auth/webauthn';

export const POST = mutation(z.object({}), async () => {
  await enforceLimit('login-options', await clientIp());
  return { options: await authenticationOptions() };
});
