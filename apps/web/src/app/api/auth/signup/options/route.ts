import { z } from 'zod';
import { uuidv7 } from '@everydaily/shared/util/uuidv7';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { clientIp, deviceId } from '@/server/request';
import { usernameAvailability } from '@/server/auth/accounts';
import { checkGatePass } from '@/server/auth/gate';
import { redeemPow } from '@/server/auth/pow';
import { verifyTurnstile } from '@/server/auth/turnstile';
import { registrationOptions } from '@/server/auth/webauthn';

const body = z.object({
  username: z.string().max(64),
  gatePass: z.string().max(1024),
  pow: z.object({ id: z.string().max(40), nonce: z.string().max(16) }),
  turnstileToken: z.string().max(4096).optional(),
});

/**
 * Step 3 of sign-up. Every bot-protection layer is enforced here, server-side, regardless of
 * what the browser UI did: rate limits, gate pass, proof of work, optional Turnstile.
 */
export const POST = mutation(body, async (input) => {
  const ip = await clientIp();
  const device = await deviceId();
  await enforceLimit('signup-ip', ip);
  await enforceLimit('signup-device', device);

  if (!checkGatePass(input.gatePass, device)) {
    throw new HttpError(403, 'gate_required', 'Solve the puzzle first.');
  }
  if (!(await redeemPow(input.pow.id, input.pow.nonce))) {
    throw new HttpError(
      403,
      'pow_invalid',
      'Your browser’s security check did not complete. Please try again.',
    );
  }
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    throw new HttpError(403, 'turnstile_failed', 'The human check failed. Please try again.');
  }

  const availability = await usernameAvailability(input.username);
  if (!availability.available)
    throw new HttpError(409, `username_${availability.reason}`, availability.message);

  const userId = uuidv7();
  const options = await registrationOptions({
    purpose: 'signup',
    userId,
    username: availability.username,
  });
  return { options };
});
