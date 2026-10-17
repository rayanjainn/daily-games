import { z } from 'zod';
import { passkeyCredentials } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { HttpError, mutation } from '@/server/http';
import { userAgent } from '@/server/request';
import { requireSession } from '@/server/session';
import { credentialColumns } from '@/server/auth/accounts';
import { defaultPasskeyName, takeChallenge, verifyRegistration } from '@/server/auth/webauthn';
import { registrationResponse } from '../../../auth/schemas';

export const POST = mutation(z.object({ response: registrationResponse }), async ({ response }) => {
  const { user } = await requireSession();
  const challenge = await takeChallenge('add-passkey');
  if (challenge.userId !== user.id)
    throw new HttpError(403, 'forbidden', 'That passkey request belongs to another account.');
  const info = await verifyRegistration(response, challenge.challenge);
  const transports = response.response.transports ?? [];
  try {
    await db()
      .insert(passkeyCredentials)
      .values({
        userId: user.id,
        credentialId: info.credential.id,
        ...credentialColumns({
          id: info.credential.id,
          publicKey: info.credential.publicKey,
          counter: info.credential.counter,
          transports,
          deviceType: info.credentialDeviceType,
          backedUp: info.credentialBackedUp,
          aaguid: info.aaguid,
          nickname: defaultPasskeyName(await userAgent(), transports),
        }),
      });
  } catch (err) {
    const code =
      (err as { cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
    if (code === '23505')
      throw new HttpError(409, 'passkey_exists', 'That passkey is already on your account.');
    throw err;
  }
  return { ok: true };
});
