import { cookies } from 'next/headers';
import { z } from 'zod';
import { enforceLimit, mutation } from '@/server/http';
import { clientIp, COOKIE, secureCookies, userAgent } from '@/server/request';
import { PAIR_TTL_SECONDS, startPairing } from '@/server/auth/pairing';

export const POST = mutation(z.object({}), async () => {
  await enforceLimit('pair-start', await clientIp());
  const p = await startPairing(await userAgent());
  // The poll secret proves "I am the device that started this"; it never appears in the QR code.
  (await cookies()).set(COOKIE.pair, p.pollSecret, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'strict',
    path: '/',
    maxAge: PAIR_TTL_SECONDS * 2,
  });
  return { url: p.url, number: p.number, qr: p.qr, expiresAt: p.expiresAt.toISOString() };
});
