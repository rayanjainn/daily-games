import { z } from 'zod';
import { count, eq, passkeyCredentials, users } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { clientIp } from '@/server/request';
import { startSession } from '@/server/session';
import {
  clearFailures,
  formatWait,
  lockedFor,
  recordFailure,
  verifyPassword,
} from '@/server/auth/password';
import { normalizeUsername } from '@/server/auth/username';

const body = z.object({ username: z.string().max(64), password: z.string().max(512) });

/**
 * Sign in with name and password. Rate limited per address, with an exponential lockout per name
 * and per address after repeated failures. Unknown names, accounts without a password and wrong
 * passwords take the same time and get the same answer.
 */
export const POST = mutation(body, async ({ username: raw, password }) => {
  const ip = await clientIp();
  await enforceLimit('password-login-ip', ip);
  const username = normalizeUsername(raw);
  const wait = await lockedFor(username, ip);
  if (wait > 0)
    throw new HttpError(
      429,
      'locked',
      `Too many wrong attempts. Try again in ${formatWait(wait)}.`,
      {
        retryAfter: wait,
      },
    );

  const [row] = await db()
    .select({ id: users.id, hash: users.passwordHash, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const ok = await verifyPassword(row && !row.deletedAt ? row.hash : null, password);
  if (!ok || !row) {
    await recordFailure(username, ip);
    throw new HttpError(401, 'login_failed', "That name and password don't match.");
  }
  await clearFailures(username);
  await startSession(row.id, 'password');
  const [keys] = await db()
    .select({ n: count() })
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, row.id));
  return { ok: true, hasPasskey: (keys?.n ?? 0) > 0 };
});
