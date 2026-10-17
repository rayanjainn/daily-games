import {
  AUTH_PROTOCOL_PREFIX,
  REALTIME_SUBPROTOCOL,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  broadcastSchema,
  importVerifyKey,
  parseRoom,
  verifyInternalRequest,
  verifyRealtimeToken,
} from '@everydaily/shared/realtime';
import type { Env } from './env';

let cachedKey: { raw: string; key: Promise<CryptoKey> } | null = null;
function verifyKey(env: Env) {
  if (cachedKey?.raw !== env.REALTIME_PUBLIC_KEY) {
    cachedKey = { raw: env.REALTIME_PUBLIC_KEY, key: importVerifyKey(env.REALTIME_PUBLIC_KEY) };
  }
  return cachedKey.key;
}

/** GET /rt/:type/:id — WebSocket upgrade. Token travels in Sec-WebSocket-Protocol. */
export async function handleConnect(request: Request, env: Env, path: string): Promise<Response> {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }
  const room = parseRoom(path.replace(/^\/rt\//, '').replace('/', ':'));
  if (!room) return new Response('Unknown room', { status: 404 });
  const roomName = `${room.type}:${room.id}`;

  const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '')
    .split(',')
    .map((p) => p.trim());
  if (!protocols.includes(REALTIME_SUBPROTOCOL)) {
    return new Response('Unsupported protocol', { status: 400 });
  }
  const token = protocols
    .find((p) => p.startsWith(AUTH_PROTOCOL_PREFIX))
    ?.slice(AUTH_PROTOCOL_PREFIX.length);
  if (!token) return new Response('Missing token', { status: 401 });

  const res = await verifyRealtimeToken(await verifyKey(env), token);
  if (!res.ok) return new Response(`Invalid token: ${res.error}`, { status: 401 });
  if (res.claims.room !== roomName)
    return new Response('Token not valid for this room', { status: 403 });
  if (!res.claims.perms.includes('read')) return new Response('Forbidden', { status: 403 });

  const stub = env.ROOMS.get(env.ROOMS.idFromName(roomName));
  const headers = new Headers(request.headers);
  headers.set('x-ed-claims', JSON.stringify(res.claims));
  return stub.fetch(new Request('https://room/connect', { headers }));
}

/** POST /internal/broadcast — called by the web app after it commits a write. */
export async function handleBroadcast(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (body.length > 64 * 1024) return new Response('Too large', { status: 413 });
  const ok = await verifyInternalRequest(
    env.INTERNAL_BROADCAST_SECRET,
    body,
    request.headers.get(SIGNATURE_HEADER),
    request.headers.get(TIMESTAMP_HEADER),
  );
  if (!ok) return new Response('Bad signature', { status: 401 });

  let parsed: ReturnType<typeof broadcastSchema.safeParse>;
  try {
    parsed = broadcastSchema.safeParse(JSON.parse(body));
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!parsed.success || !parseRoom(parsed.data.room))
    return new Response('Invalid body', { status: 400 });

  const stub = env.ROOMS.get(env.ROOMS.idFromName(parsed.data.room));
  return stub.fetch('https://room/broadcast', {
    method: 'POST',
    body: JSON.stringify({ kind: parsed.data.kind, data: parsed.data.data }),
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /internal/push-test — the web app asks for a test notification to a player's devices. */
export async function handlePushTest(
  request: Request,
  env: Env,
  deliver: (userId: string) => Promise<unknown>,
): Promise<Response> {
  const body = await request.text();
  if (body.length > 1024) return new Response('Too large', { status: 413 });
  const ok = await verifyInternalRequest(
    env.INTERNAL_BROADCAST_SECRET,
    body,
    request.headers.get(SIGNATURE_HEADER),
    request.headers.get(TIMESTAMP_HEADER),
  );
  if (!ok) return new Response('Bad signature', { status: 401 });
  let userId: unknown;
  try {
    userId = (JSON.parse(body) as { userId?: unknown }).userId;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (typeof userId !== 'string' || !UUID.test(userId))
    return new Response('Invalid body', { status: 400 });
  return Response.json(await deliver(userId));
}
