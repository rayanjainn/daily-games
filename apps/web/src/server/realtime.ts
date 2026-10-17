import 'server-only';
import {
  importSigningKey,
  signInternalRequest,
  signRealtimeToken,
  type RealtimeClaims,
} from '@everydaily/shared/realtime';
import { serverEnv } from './env';

let signingKey: Promise<CryptoKey> | null = null;
function key() {
  signingKey ??= importSigningKey(serverEnv().REALTIME_SIGNING_KEY);
  return signingKey;
}

export async function mintRealtimeToken(
  input: Pick<RealtimeClaims, 'sub' | 'name' | 'room' | 'perms'>,
) {
  return signRealtimeToken(await key(), input);
}

/** Publishes an event to a room after the corresponding write has been committed. */
export async function publishToRoom(room: string, kind: string, data: unknown) {
  const { WORKER_INTERNAL_URL, INTERNAL_BROADCAST_SECRET } = serverEnv();
  const body = JSON.stringify({ room, kind, data });
  const res = await fetch(new URL('/internal/broadcast', WORKER_INTERNAL_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(await signInternalRequest(INTERNAL_BROADCAST_SECRET, body)),
    },
    body,
  });
  if (!res.ok) throw new Error(`broadcast failed: ${res.status}`);
  return (await res.json()) as { seq: number; delivered: number };
}
