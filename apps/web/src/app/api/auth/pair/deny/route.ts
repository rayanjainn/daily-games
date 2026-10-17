import { z } from 'zod';
import { mutation } from '@/server/http';
import { requireSession } from '@/server/session';
import { denyPairing } from '@/server/auth/pairing';

export const POST = mutation(z.object({ code: z.string().max(40) }), async ({ code }) => {
  await requireSession();
  await denyPairing(code);
  return { ok: true };
});
