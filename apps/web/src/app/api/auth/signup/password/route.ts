import { z } from 'zod';
import { uuidv7 } from '@everydaily/shared/util/uuidv7';
import { HttpError, mutation } from '@/server/http';
import { startSession } from '@/server/session';
import { createAccount } from '@/server/auth/accounts';
import { hashPassword, PASSWORD_MAX, passwordProblem } from '@/server/auth/password';
import { timezone } from '../../schemas';
import { botFields, guardSignup } from '../guard';

/** Sign-up with a password, for devices without passkeys. A passkey can be added later. */
export const POST = mutation(
  z.object({ ...botFields, password: z.string().max(PASSWORD_MAX * 4), timezone }),
  async ({ password, timezone: tz, ...bot }) => {
    const username = await guardSignup(bot);
    const problem = passwordProblem(password, username);
    if (problem) throw new HttpError(422, 'weak_password', problem);
    const userId = uuidv7();
    await createAccount({
      userId,
      username,
      timezone: tz,
      passwordHash: await hashPassword(password),
    });
    await startSession(userId, 'signup');
    return { username };
  },
);
