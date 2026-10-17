import { z } from 'zod';
import { mutation } from '@/server/http';
import { endSession } from '@/server/session';

export const POST = mutation(z.object({}), async () => {
  await endSession();
  return { ok: true };
});
