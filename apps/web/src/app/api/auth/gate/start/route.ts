import { z } from 'zod';
import { enforceLimit, mutation } from '@/server/http';
import { clientIp, deviceId } from '@/server/request';
import { startGate } from '@/server/auth/gate';

export const POST = mutation(z.object({}), async () => {
  await enforceLimit('gate-start', await clientIp());
  return startGate(await deviceId());
});
