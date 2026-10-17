import { cookies } from 'next/headers';
import { z } from 'zod';
import { mutation } from '@/server/http';
import { clearCookie, COOKIE } from '@/server/request';
import { startSession } from '@/server/session';
import { consumePairing } from '@/server/auth/pairing';

export const POST = mutation(z.object({}), async () => {
  const userId = await consumePairing((await cookies()).get(COOKIE.pair)?.value);
  await clearCookie(COOKIE.pair);
  await startSession(userId, 'pairing');
  return { ok: true };
});
