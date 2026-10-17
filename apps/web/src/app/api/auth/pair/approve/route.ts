import { z } from 'zod';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';
import { approvePairing } from '@/server/auth/pairing';

export const POST = mutation(
  z.object({ code: z.string().max(40), number: z.number().int().min(10).max(99) }),
  async ({ code, number }) => {
    const { user } = await requireSession();
    await enforceLimit('pair-approve', user.id);
    const res = await approvePairing(code, number, user.id);
    if (res === 'wrong_number') {
      throw new HttpError(
        400,
        'pair_wrong_number',
        "That number didn't match, so we cancelled the request to be safe. Start again on the other device.",
      );
    }
    return { ok: true };
  },
);
