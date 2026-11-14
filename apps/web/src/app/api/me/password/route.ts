import { z } from 'zod';
import { count, eq, passkeyCredentials, users } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';
import {
  hashPassword,
  PASSWORD_MAX,
  passwordProblem,
  verifyPassword,
} from '@/server/auth/password';

/**
 * Sets or changes the password. Changing one needs the current password, so a borrowed signed-in
 * device can't quietly take the account over.
 */
export const PUT = mutation(
  z
    .object({
      password: z.string().max(PASSWORD_MAX * 4),
      current: z.string().max(512).optional(),
    })
    .strict(),
  async ({ password, current }) => {
    const { user } = await requireSession();
    await enforceLimit('password-change', user.id);
    if (user.passwordHash && !(await verifyPassword(user.passwordHash, current ?? '')))
      throw new HttpError(403, 'wrong_password', 'Your current password is not right.');
    const problem = passwordProblem(password, user.username);
    if (problem) throw new HttpError(422, 'weak_password', problem);
    await db()
      .update(users)
      .set({ passwordHash: await hashPassword(password), passwordSetAt: new Date() })
      .where(eq(users.id, user.id));
    return { ok: true };
  },
);

/** Removes the password, as long as a passkey is left to sign in with. */
export const DELETE = mutation(
  z.object({ current: z.string().max(512) }).strict(),
  async ({ current }) => {
    const { user } = await requireSession();
    await enforceLimit('password-change', user.id);
    if (!user.passwordHash) return { ok: true };
    if (!(await verifyPassword(user.passwordHash, current)))
      throw new HttpError(403, 'wrong_password', 'Your current password is not right.');
    const [keys] = await db()
      .select({ n: count() })
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, user.id));
    if (!keys?.n)
      throw new HttpError(
        409,
        'last_credential',
        'Your password is your only way in. Add a passkey before removing it.',
      );
    await db()
      .update(users)
      .set({ passwordHash: null, passwordSetAt: null })
      .where(eq(users.id, user.id));
    return { ok: true };
  },
);
