import { NextResponse } from 'next/server';
import { z } from 'zod';
import { REALTIME_TOKEN_TTL_SECONDS, parseRoom } from '@everydaily/shared/realtime';
import { getCurrentUser } from '@/server/current-user';
import { serverEnv } from '@/server/env';
import { mintRealtimeToken } from '@/server/realtime';

const bodySchema = z.object({ room: z.string().max(80) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const room = parsed.success ? parseRoom(parsed.data.room) : null;
  if (!parsed.success || !room)
    return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  // Membership and visibility checks per room type arrive with groups and communities.
  const { token } = await mintRealtimeToken({
    sub: user.id,
    name: user.username,
    room: parsed.data.room,
    perms: ['read', 'typing', 'presence'],
  });

  const url = new URL(`/rt/${room.type}/${room.id}`, serverEnv().REALTIME_URL).toString();
  return NextResponse.json(
    { token, url, expiresIn: REALTIME_TOKEN_TTL_SECONDS },
    { headers: { 'cache-control': 'no-store' } },
  );
}
