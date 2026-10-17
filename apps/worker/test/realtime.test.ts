import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { RING_BUFFER_SIZE } from '@everydaily/shared/realtime';
import { TestClient, broadcast, mintToken, sleep, upgrade } from './realtime-helpers';

const open: TestClient[] = [];
async function connect(...args: Parameters<typeof TestClient.connect>) {
  const c = await TestClient.connect(...args);
  open.push(c);
  return c;
}
afterEach(() => {
  for (const c of open.splice(0)) c.close();
});

let roomCounter = 0;
const freshRoom = () => `group:room-${Date.now().toString(36)}-${roomCounter++}`;

describe('connect / auth', () => {
  it('accepts a valid token, echoes the subprotocol and sends hello with presence', async () => {
    const room = freshRoom();
    const token = await mintToken({ room });
    const res = await upgrade(`/rt/${room.replace(':', '/')}`, `ed.v1, auth.${token}`);
    expect(res.status).toBe(101);
    expect(res.headers.get('Sec-WebSocket-Protocol')).toBe('ed.v1');
    const c = new TestClient(res.webSocket!);
    open.push(c);
    const hello = await c.waitFor((m) => m.t === 'hello');
    expect(hello).toEqual({
      t: 'hello',
      seq: 0,
      presence: [{ userId: 'user-a', name: 'brave-otter-12' }],
    });
  });

  it('rejects requests that are not upgrades', async () => {
    const res = await upgrade('/rt/group/abc', null);
    expect([400, 426]).toContain(res.status);
  });

  it('rejects missing subprotocol, missing token, bad token', async () => {
    const token = await mintToken();
    expect((await upgrade('/rt/group/abc', `auth.${token}`)).status).toBe(400);
    expect((await upgrade('/rt/group/abc', 'ed.v1')).status).toBe(401);
    expect((await upgrade('/rt/group/abc', 'ed.v1, auth.not-a-token')).status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await mintToken({}, { now: new Date(Date.now() - 10 * 60_000) });
    const res = await upgrade('/rt/group/abc', `ed.v1, auth.${token}`);
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('expired');
  });

  it('rejects a token minted for another room (room isolation at the door)', async () => {
    const token = await mintToken({ room: 'group:other' });
    expect((await upgrade('/rt/group/abc', `ed.v1, auth.${token}`)).status).toBe(403);
  });

  it('rejects a token without read permission', async () => {
    const token = await mintToken({ perms: ['typing'] });
    expect((await upgrade('/rt/group/abc', `ed.v1, auth.${token}`)).status).toBe(403);
  });

  it('rejects unknown room types', async () => {
    const token = await mintToken();
    expect((await upgrade('/rt/admin/abc', `ed.v1, auth.${token}`)).status).toBe(404);
  });

  it('rejects a replayed token (single use)', async () => {
    const room = freshRoom();
    const token = await mintToken({ room });
    const path = `/rt/${room.replace(':', '/')}`;
    const first = await upgrade(path, `ed.v1, auth.${token}`);
    expect(first.status).toBe(101);
    open.push(new TestClient(first.webSocket!));
    expect((await upgrade(path, `ed.v1, auth.${token}`)).status).toBe(401);
  });
});

describe('events', () => {
  it('broadcasts signed events to every socket in order with increasing seq', async () => {
    const room = freshRoom();
    const a = await connect(room);
    const b = await connect(room, { sub: 'user-b', name: 'calm-fox-7' });
    for (let i = 1; i <= 5; i++)
      expect((await broadcast(room, 'comment.created', { i })).status).toBe(200);
    for (const c of [a, b]) {
      await c.waitFor((m) => m.t === 'event' && m.seq === 5);
      const events = c.messages.filter((m) => m.t === 'event');
      expect(events.map((e) => (e.t === 'event' ? e.seq : -1))).toEqual([1, 2, 3, 4, 5]);
      expect(events.map((e) => (e.t === 'event' ? (e.data as { i: number }).i : -1))).toEqual([
        1, 2, 3, 4, 5,
      ]);
    }
  });

  it('rejects broadcasts with a bad signature', async () => {
    const res = await broadcast('group:abc', 'x', {}, 'wrong-secret');
    expect(res.status).toBe(401);
  });

  it('does not leak events across rooms', async () => {
    const roomA = freshRoom();
    const roomB = freshRoom();
    const a = await connect(roomA);
    const b = await connect(roomB);
    await broadcast(roomB, 'comment.created', { secret: true });
    await b.waitFor((m) => m.t === 'event');
    await sleep(100);
    expect(a.messages.some((m) => m.t === 'event')).toBe(false);
  });

  it('replays missed events on resume', async () => {
    const room = freshRoom();
    const a = await connect(room);
    for (let i = 1; i <= 3; i++) await broadcast(room, 'k', { i });
    await a.waitFor((m) => m.t === 'event' && m.seq === 3);
    const b = await connect(room, { sub: 'user-b', name: 'calm-fox-7' });
    b.send({ t: 'resume', since: 1 });
    await b.waitFor((m) => m.t === 'event' && m.seq === 3);
    expect(
      b.messages.filter((m) => m.t === 'event').map((m) => (m.t === 'event' ? m.seq : 0)),
    ).toEqual([2, 3]);
  });

  it('asks the client to resync when the gap exceeds the ring buffer', async () => {
    const room = freshRoom();
    for (let i = 0; i < RING_BUFFER_SIZE + 5; i++) await broadcast(room, 'k', { i });
    const c = await connect(room);
    c.send({ t: 'resume', since: 0 });
    await c.waitFor((m) => m.t === 'resync');
  });
});

describe('presence and typing', () => {
  it('announces joins and leaves', async () => {
    const room = freshRoom();
    const a = await connect(room);
    const b = await connect(room, { sub: 'user-b', name: 'calm-fox-7' });
    await a.waitFor((m) => m.t === 'presence' && m.joined?.userId === 'user-b');
    b.close();
    await a.waitFor((m) => m.t === 'presence' && m.left?.userId === 'user-b');
  });

  it('relays typing to others and throttles bursts', async () => {
    const room = freshRoom();
    const a = await connect(room);
    const b = await connect(room, { sub: 'user-b', name: 'calm-fox-7' });
    a.send({ t: 'typing' });
    a.send({ t: 'typing' });
    a.send({ t: 'typing' });
    await b.waitFor((m) => m.t === 'typing' && m.userId === 'user-a');
    await sleep(150);
    expect(b.messages.filter((m) => m.t === 'typing')).toHaveLength(1);
    expect(a.messages.some((m) => m.t === 'typing')).toBe(false);
  });

  it('refuses typing without the permission', async () => {
    const room = freshRoom();
    const a = await connect(room, { perms: ['read'] });
    a.send({ t: 'typing' });
    await a.waitFor((m) => m.t === 'error' && m.code === 'forbidden');
  });

  it('closes on malformed frames', async () => {
    const a = await connect(freshRoom());
    a.send('{not json');
    expect((await a.waitForClose()).code).toBe(4400);
  });
});

describe('hibernation', () => {
  it('keeps sockets, presence and ordering across an eviction', async () => {
    const room = freshRoom();
    const a = await TestClient.connect(room);
    open.push(a);
    await broadcast(room, 'k', { before: true });
    await a.waitFor((m) => m.t === 'event' && m.seq === 1);

    const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
    // Mark the live instance so we can prove a new one was constructed after eviction.
    await runInDurableObject(stub, (instance) => {
      (instance as unknown as { marker?: string }).marker = 'before-eviction';
    });
    await evictDurableObject(stub, { webSockets: 'hibernate' });

    await broadcast(room, 'k', { after: true });
    await a.waitFor((m) => m.t === 'event' && m.seq === 2);
    const marker = await runInDurableObject(
      stub,
      (instance) => (instance as unknown as { marker?: string }).marker,
    );
    expect(marker).toBeUndefined();

    // The woken instance still sees the hibernated socket's attachment.
    a.send({ t: 'typing' });
    const b = await TestClient.connect(room, { sub: 'user-b', name: 'calm-fox-7' });
    open.push(b);
    const hello = await b.waitFor((m) => m.t === 'hello');
    expect(hello).toMatchObject({ seq: 2 });
    expect(hello.t === 'hello' && hello.presence.map((p) => p.userId).sort()).toEqual([
      'user-a',
      'user-b',
    ]);
    expect(a.closed).toBeNull();
  });
});

describe('reauth', () => {
  it('extends the deadline with a fresh token for the same user and room', async () => {
    const room = freshRoom();
    const a = await connect(room);
    a.send({ t: 'reauth', token: await mintToken({ room }) });
    await a.waitFor((m) => m.t === 'reauthed');
  });

  it("closes with 4401 when reauth uses another user's token", async () => {
    const room = freshRoom();
    const a = await connect(room);
    a.send({ t: 'reauth', token: await mintToken({ room, sub: 'user-z' }) });
    expect((await a.waitForClose()).code).toBe(4401);
  });

  it('closes sockets past their reauth deadline on the next message and on the sweep alarm', async () => {
    const room = freshRoom();
    const a = await connect(room);
    const b = await connect(room, { sub: 'user-b', name: 'calm-fox-7' });
    const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
    await runInDurableObject(stub, (_instance, state) => {
      for (const ws of state.getWebSockets()) {
        ws.serializeAttachment({ ...ws.deserializeAttachment(), reauthBy: Date.now() - 1 });
      }
    });
    a.send({ t: 'typing' });
    expect((await a.waitForClose()).code).toBe(4401);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await b.waitForClose()).code).toBe(4401);
  });
});
