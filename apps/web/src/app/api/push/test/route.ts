import { z } from 'zod';
import { enforceLimit, mutation } from '@/server/http';
import { sendTestPush } from '@/server/reminders';
import { requireSession } from '@/server/session';

/** Sends a test notification to all of the player's devices. */
export const POST = mutation(z.object({}).strict(), async () => {
  const { user } = await requireSession();
  await enforceLimit('push-test', user.id);
  return sendTestPush(user.id);
});
