import { z } from 'zod';
import { enforceLimit, HttpError } from '@/server/http';
import { clientIp, deviceId } from '@/server/request';
import { usernameAvailability } from '@/server/auth/accounts';
import { redeemPow } from '@/server/auth/pow';
import { verifyTurnstile } from '@/server/auth/turnstile';

export const botFields = {
  username: z.string().max(64),
  pow: z.object({ id: z.string().max(40), nonce: z.string().max(16) }),
  turnstileToken: z.string().max(4096).optional(),
};

/**
 * Every sign-up path passes the same invisible checks, server-side, whatever the browser did:
 * per-address and per-device rate limits, a proof of work the browser solved in the background,
 * and Turnstile when it is switched on. Returns the normalised, available name.
 */
export async function guardSignup(input: {
  username: string;
  pow: { id: string; nonce: string };
  turnstileToken?: string;
}): Promise<string> {
  const ip = await clientIp();
  await enforceLimit('signup-ip', ip);
  await enforceLimit('signup-device', await deviceId());
  if (!(await redeemPow(input.pow.id, input.pow.nonce)))
    throw new HttpError(
      403,
      'pow_invalid',
      'Your browser’s security check did not complete. Please try again.',
    );
  if (!(await verifyTurnstile(input.turnstileToken, ip)))
    throw new HttpError(403, 'turnstile_failed', 'The human check failed. Please try again.');
  const availability = await usernameAvailability(input.username);
  if (!availability.available)
    throw new HttpError(409, `username_${availability.reason}`, availability.message);
  return availability.username;
}
