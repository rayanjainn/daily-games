import { z } from 'zod';
import { mutation } from '@/server/http';
import { userAgent } from '@/server/request';
import { startSession } from '@/server/session';
import { createAccount } from '@/server/auth/accounts';
import { generatePhrase, hashPhrase, startConfirmation } from '@/server/auth/recovery';
import { defaultPasskeyName, takeChallenge, verifyRegistration } from '@/server/auth/webauthn';
import { registrationResponse, timezone } from '../../schemas';

export const POST = mutation(
  z.object({ response: registrationResponse, timezone }),
  async ({ response, timezone: tz }) => {
    const challenge = await takeChallenge('signup');
    const info = await verifyRegistration(response, challenge.challenge);

    const phrase = generatePhrase();
    const transports = response.response.transports ?? [];
    await createAccount({
      userId: challenge.userId!,
      username: challenge.username!,
      timezone: tz,
      recoveryHash: await hashPhrase(phrase),
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
    const confirm = await startConfirmation(challenge.userId!, phrase);

    // The phrase is returned exactly once and never stored in readable form.
    return { username: challenge.username, recoveryPhrase: phrase, confirm };
  },
);
