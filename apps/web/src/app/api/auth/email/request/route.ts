import { emailInputSchema, emailEnabled, sendLoginLink } from '@/server/email';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { clientIp } from '@/server/request';

/**
 * Asks for a sign-in link. The reply is the same whether or not the address is on an account, so
 * this can't be used to find out who has one.
 */
export const POST = mutation(emailInputSchema, async ({ email }) => {
  if (!emailEnabled())
    throw new HttpError(503, 'email_unavailable', "Email isn't set up on this server.");
  await enforceLimit('email-login-ip', await clientIp());
  await enforceLimit('email-login-address', email);
  await sendLoginLink(email);
  return { ok: true };
});
