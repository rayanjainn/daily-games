import { z } from 'zod';
import { emailInputSchema, removeEmail, startEmailVerification } from '@/server/email';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

/** Adds or changes the account email and sends a confirmation link. */
export const POST = mutation(emailInputSchema, async ({ email }) => {
  const { user } = await requireSession();
  await enforceLimit('email-verify', user.id);
  return startEmailVerification(user.id, email);
});

export const DELETE = mutation(z.object({}).strict(), async () => {
  const { user } = await requireSession();
  await removeEmail(user.id);
  return { ok: true };
});
