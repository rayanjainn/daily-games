import { z } from 'zod';
import { REALTIME_TOKEN_TTL_SECONDS, parseRoom } from '@everydaily/shared/realtime';
import { ensureCommunity, postView } from '@/server/community';
import { serverEnv } from '@/server/env';
import { membership } from '@/server/groups';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { mintRealtimeToken } from '@/server/realtime';
import { requireSession } from '@/server/session';

/**
 * A 60-second token for one room, only for players allowed in it: group members, and anyone
 * who can see the post or community.
 */
export const POST = mutation(z.object({ room: z.string().max(80) }).strict(), async ({ room }) => {
  const { user } = await requireSession();
  await enforceLimit('realtime-token', user.id);
  const r = parseRoom(room);
  if (!r) throw new HttpError(400, 'invalid_room', 'Unknown room.');
  let config: ReturnType<typeof serverEnv>;
  try {
    config = serverEnv();
  } catch {
    throw new HttpError(503, 'realtime_unavailable', 'Live updates are off on this server.');
  }
  const allowed =
    r.type === 'group'
      ? Boolean(await membership(user.id, r.id))
      : r.type === 'thread'
        ? Boolean(await postView(user, r.id))
        : Boolean(await ensureCommunity(r.id));
  if (!allowed) throw new HttpError(403, 'forbidden', 'You are not in this room.');

  const { token } = await mintRealtimeToken({
    sub: user.id,
    name: user.displayName ?? user.username,
    room,
    perms: ['read', 'typing', 'presence'],
  });
  const url = new URL(`/rt/${r.type}/${r.id}`, config.REALTIME_URL).toString();
  return { token, url, expiresIn: REALTIME_TOKEN_TTL_SECONDS };
});
