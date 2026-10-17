import { z } from 'zod';
import {
  eq,
  passkeyCredentials,
  recoveryPhraseHashes,
  sessions,
  users,
} from '@everydaily/shared/db';
import { db } from '@/server/db';
import { HttpError, mutation } from '@/server/http';
import { clearCookie, COOKIE } from '@/server/request';
import { requireSession } from '@/server/session';

/**
 * Deletes the account: sign-in methods and sessions are removed at once, the row is marked
 * deleted, and a scheduled job purges it (and all results) after 7 days.
 */
export const POST = mutation(
  z.object({ confirmUsername: z.string().max(64) }),
  async ({ confirmUsername }) => {
    const { user } = await requireSession();
    if (confirmUsername.trim().toLowerCase() !== user.username) {
      throw new HttpError(400, 'confirm_mismatch', 'Type your player name exactly to confirm.');
    }
    await db().transaction(async (tx) => {
      await tx.delete(passkeyCredentials).where(eq(passkeyCredentials.userId, user.id));
      await tx.delete(recoveryPhraseHashes).where(eq(recoveryPhraseHashes.userId, user.id));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, user.id));
      await tx
        .update(users)
        .set({ deletedAt: new Date(), email: null })
        .where(eq(users.id, user.id));
    });
    await clearCookie(COOKIE.session);
    return { ok: true };
  },
);
