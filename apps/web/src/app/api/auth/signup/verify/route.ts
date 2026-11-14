import { z } from 'zod';
import { mutation } from '@/server/http';
import { userAgent } from '@/server/request';
import { startSession } from '@/server/session';
import { createAccount } from '@/server/auth/accounts';
import { defaultPasskeyName, takeChallenge, verifyRegistration } from '@/server/auth/webauthn';
import { registrationResponse, timezone } from '../../schemas';

/** Sign-up with a passkey, step 2: the account and its first passkey, then a session. */
export const POST = mutation(
  z.object({ response: registrationResponse, timezone }),
  async ({ response, timezone: tz }) => {
    const challenge = await takeChallenge('signup');
    const info = await verifyRegistration(response, challenge.challenge);
    const transports = response.response.transports ?? [];
    await createAccount({
      userId: challenge.userId!,
      username: challenge.username!,
      timezone: tz,
      credential: {
        id: info.credential.id,
        publicKey: info.credential.publicKey,
        counter: info.credential.counter,
        transports,
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        aaguid: info.aaguid,
        nickname: defaultPasskeyName(await userAgent(), transports),
      },
    });
    await startSession(challenge.userId!, 'signup');
    return { username: challenge.username };
  },
);
