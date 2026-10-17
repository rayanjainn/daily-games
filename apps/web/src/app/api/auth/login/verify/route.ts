import { z } from 'zod';
import { eq, passkeyCredentials, users } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { clientIp } from '@/server/request';
import { startSession } from '@/server/session';
import { takeChallenge, verifyAuthentication } from '@/server/auth/webauthn';
import { authenticationResponse } from '../../schemas';

export const POST = mutation(
  z.object({ response: authenticationResponse }),
  async ({ response }) => {
    await enforceLimit('login-verify', await clientIp());
    const challenge = await takeChallenge('login');

    const rows = await db()
      .select({ cred: passkeyCredentials, user: users })
      .from(passkeyCredentials)
      .innerJoin(users, eq(users.id, passkeyCredentials.userId))
      .where(eq(passkeyCredentials.credentialId, response.id))
      .limit(1);
    const row = rows[0];
    // Same message whether the passkey is unknown or revoked: nothing to enumerate.
    if (!row || row.user.deletedAt) {
      throw new HttpError(
        400,
        'passkey_unknown',
        "We don't recognise that passkey. It may have been removed from your account.",
      );
    }

    const info = await verifyAuthentication(response, challenge.challenge, {
      id: row.cred.credentialId,
      publicKey: row.cred.publicKey,
      counter: row.cred.counter,
      transports: row.cred.transports,
    });
    await db()
      .update(passkeyCredentials)
      .set({ counter: info.newCounter, lastUsedAt: new Date(), backedUp: info.credentialBackedUp })
      .where(eq(passkeyCredentials.id, row.cred.id));

    await startSession(row.user.id, 'passkey');
    return { username: row.user.username };
  },
);
