import { z } from 'zod';
import { enforceLimit, mutation } from '@/server/http';
import { clientIp } from '@/server/request';
import { issuePow } from '@/server/auth/pow';

export const POST = mutation(z.object({}), async () => {
  await enforceLimit('pow-challenge', await clientIp());
  return issuePow();
});
