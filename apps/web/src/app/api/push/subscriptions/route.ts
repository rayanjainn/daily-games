import { z } from 'zod';
import { enforceLimit, mutation } from '@/server/http';
import { removeSubscription, saveSubscription, subscriptionSchema } from '@/server/reminders';
import { requireSession } from '@/server/session';

/** Registers this browser for reminders. */
export const POST = mutation(subscriptionSchema, async (s) => {
  const { user } = await requireSession();
  await enforceLimit('push-subscribe', user.id);
  await saveSubscription(user.id, s);
  return { ok: true };
});

/** Stops reminders on this browser. */
export const DELETE = mutation(z.object({ endpoint: z.string().max(1000) }).strict(), async (b) => {
  const { user } = await requireSession();
  await removeSubscription(user.id, b.endpoint);
  return { ok: true };
});
