import { z } from 'zod';
import { eq, recoveryPhraseHashes, users } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';
import { generatePhrase, hashPhrase, startConfirmation } from '@/server/auth/recovery';

/** Replaces the recovery phrase; the old one stops working immediately. Shown once. */
export const POST = mutation(z.object({}), async () => {
  const { user } = await requireSession();
  await enforceLimit('recovery-regen', user.id);
  const phrase = generatePhrase();
  const hash = await hashPhrase(phrase);
  await db().transaction(async (tx) => {
    await tx
      .insert(recoveryPhraseHashes)
      .values({ userId: user.id, hash })
      .onConflictDoUpdate({
        target: recoveryPhraseHashes.userId,
        set: { hash, createdAt: new Date() },
      });
    await tx.update(users).set({ recoveryConfirmedAt: null }).where(eq(users.id, user.id));
  });
  const confirm = await startConfirmation(user.id, phrase);
  return { recoveryPhrase: phrase, confirm };
});
