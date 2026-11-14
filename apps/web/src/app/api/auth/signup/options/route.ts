import { z } from 'zod';
import { uuidv7 } from '@everydaily/shared/util/uuidv7';
import { mutation } from '@/server/http';
import { registrationOptions } from '@/server/auth/webauthn';
import { botFields, guardSignup } from '../guard';

/** Sign-up with a passkey, step 1: checks and the registration challenge. */
export const POST = mutation(z.object(botFields), async (input) => {
  const username = await guardSignup(input);
  const options = await registrationOptions({ purpose: 'signup', userId: uuidv7(), username });
  return { options };
});
