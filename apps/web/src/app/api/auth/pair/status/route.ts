import { cookies } from 'next/headers';
import { enforceLimit, query } from '@/server/http';
import { clientIp, COOKIE } from '@/server/request';
import { pairingStatus } from '@/server/auth/pairing';

export const GET = query(async () => {
  await enforceLimit('pair-poll', await clientIp());
  const status = await pairingStatus((await cookies()).get(COOKIE.pair)?.value);
  return { status: status ?? 'expired' };
});
