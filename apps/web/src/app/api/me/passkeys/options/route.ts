import { z } from 'zod';
import { eq, passkeyCredentials } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, mutation } from '@/server/http';
import { requireSession } from '@/server/session';
import { registrationOptions } from '@/server/auth/webauthn';

/** Start adding another passkey to the signed-in account. */
export const POST = mutation(z.object({}), async () => {
  const { user } = await requireSession();
  await enforceLimit('passkey-add', user.id);
  const existing = await db()
    .select({ id: passkeyCredentials.credentialId, transports: passkeyCredentials.transports })
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, user.id));
  return {
    options: await registrationOptions({
      purpose: 'add-passkey',
      userId: user.id,
      username: user.username,
      exclude: existing,
    }),
  };
});
