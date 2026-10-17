import { z } from 'zod';
import { eq, recoveryPhraseHashes, users } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { clientIp } from '@/server/request';
import { startSession } from '@/server/session';
import {
  clearFailures,
  lockedFor,
  normalizePhrase,
  recordFailure,
  verifyPhrase,
} from '@/server/auth/recovery';
import { normalizeUsername } from '@/server/auth/username';

const body = z.object({ username: z.string().max(64), phrase: z.string().max(400) });

/**
 * Sign in with username + recovery phrase. Rate-limited per IP, with exponential lockout per
 * username and per IP after repeated failures. Unknown usernames take the same time and return
 * the same error as a wrong phrase.
 */
export const POST = mutation(body, async ({ username: raw, phrase }) => {
  const ip = await clientIp();
  await enforceLimit('recover-ip', ip);
  const username = normalizeUsername(raw);

  const wait = await lockedFor(username, ip);
  if (wait > 0) {
    throw new HttpError(
      429,
      'locked',
      `Too many wrong attempts. Try again in ${formatWait(wait)}.`,
      { retryAfter: wait },
    );
  }

  const rows = await db()
    .select({ id: users.id, hash: recoveryPhraseHashes.hash, deletedAt: users.deletedAt })
    .from(users)
    .leftJoin(recoveryPhraseHashes, eq(recoveryPhraseHashes.userId, users.id))
    .where(eq(users.username, username))
    .limit(1);
  const row = rows[0];
  const ok = await verifyPhrase(
    row && !row.deletedAt ? (row.hash ?? null) : null,
    normalizePhrase(phrase),
  );
  if (!ok || !row) {
    await recordFailure(username, ip);
    throw new HttpError(
      401,
      'recovery_failed',
      "That name and phrase don't match. Check the words and their order.",
    );
  }

  await clearFailures(username);
  await startSession(row.id, 'recovery');
  return { ok: true };
});

function formatWait(s: number) {
  if (s < 90) return `${s} seconds`;
  if (s < 5400) return `${Math.ceil(s / 60)} minutes`;
  return `${Math.ceil(s / 3600)} hours`;
}
