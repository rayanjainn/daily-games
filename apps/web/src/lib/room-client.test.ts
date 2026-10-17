import { describe, expect, it } from 'vitest';
import { backoffDelay, RoomClient, type RoomDeps, type RoomState } from './room-client';

class FakeSocket {
  readyState = 1;
  sent: unknown[] = [];
  closed: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(
    public url: string,
    public protocols: string[],
  ) {}
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close(code = 1000) {
    this.closed = code;
  }
  server(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const events: [string, unknown][] = [];
  const states: RoomState[] = [];
  let clock = 1_000;
  const deps: RoomDeps = {
    getToken: async () => ({ token: 'tok', url: 'wss://rt.test/rt/thread/abc' }),
    openSocket: (url, protocols) => {
      const s = new FakeSocket(url, protocols);
      sockets.push(s);
      return s;
    },
    now: () => clock,
    random: () => 0.5,
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length - 1;
    },
    clearTimeout: () => undefined,
  };
  const client = new RoomClient(
    'thread:abc',
    { onState: (s) => states.push(s), onEvent: (k, d) => events.push([k, d]) },
    deps,
  );
  return {
    client,
    sockets,
    timers,
    events,
    states,
    tick: (ms: number) => (clock += ms),
    flush: () => new Promise((r) => setTimeout(r, 0)),
  };
}

describe('backoffDelay', () => {
  it('grows exponentially with full jitter and caps at 30 s', () => {
    expect(backoffDelay(0, () => 0.999)).toBe(499);
    expect(backoffDelay(3, () => 0.5)).toBe(2000);
    expect(backoffDelay(20, () => 0.999)).toBe(29_970);
    expect(backoffDelay(5, () => 0)).toBe(0);
  });
});

describe('RoomClient', () => {
  it('connects with the token in the subprotocol and goes live on hello', async () => {
    const h = harness();
    h.client.start();
    await h.flush();
    expect(h.sockets[0]!.protocols).toEqual(['ed.v1', 'auth.tok']);
    h.sockets[0]!.server({ t: 'hello', seq: 4, presence: [{ userId: 'u1', name: 'ava' }] });
    expect(h.states.at(-1)).toMatchObject({ status: 'live', presence: [{ name: 'ava' }] });
  });

  it('delivers events once and in order', async () => {
    const h = harness();
    h.client.start();
    await h.flush();
    const s = h.sockets[0]!;
    s.server({ t: 'hello', seq: 0, presence: [] });
    s.server({ t: 'event', seq: 1, kind: 'comment.created', data: { id: 'a' } });
    s.server({ t: 'event', seq: 1, kind: 'comment.created', data: { id: 'a' } });
    s.server({ t: 'event', seq: 2, kind: 'comment.created', data: { id: 'b' } });
    expect(h.events).toEqual([
      ['comment.created', { id: 'a' }],
      ['comment.created', { id: 'b' }],
    ]);
  });

  it('reconnects with backoff and resumes from the last seq', async () => {
    const h = harness();
    h.client.start();
    await h.flush();
    h.sockets[0]!.server({ t: 'hello', seq: 0, presence: [] });
    h.sockets[0]!.server({ t: 'event', seq: 7, kind: 'x', data: null });
    h.sockets[0]!.drop();
    expect(h.states.at(-1)!.status).toBe('reconnecting');
    const retry = h.timers.at(-1)!;
    expect(retry.ms).toBe(250); // attempt 0: 0.5 × 500 ms
    retry.fn();
    await h.flush();
    h.sockets[1]!.server({ t: 'hello', seq: 9, presence: [] });
    expect(h.sockets[1]!.sent).toEqual([{ t: 'resume', since: 7 }]);
  });

  it('stops for good when the room refuses access', async () => {
    const h = harness();
    h.client.start();
    await h.flush();
    const timersBefore = h.timers.length;
    h.sockets[0]!.drop(4403);
    expect(h.states.at(-1)!.status).toBe('offline');
    expect(h.timers.length).toBe(timersBefore);
  });

  it('throttles typing and tracks who is typing', async () => {
    const h = harness();
    h.client.start();
    await h.flush();
    const s = h.sockets[0]!;
    s.server({ t: 'hello', seq: 0, presence: [] });
    h.client.typing();
    h.client.typing();
    h.tick(3_000);
    h.client.typing();
    expect(s.sent.filter((m) => (m as { t: string }).t === 'typing')).toHaveLength(2);
    s.server({ t: 'typing', userId: 'u2', name: 'ben', until: 10_000 });
    expect(h.states.at(-1)!.typing).toEqual([{ userId: 'u2', name: 'ben', until: 10_000 }]);
  });

  it('stops without connecting when the server refuses a token', async () => {
    const h = harness();
    (h.client as unknown as { deps: RoomDeps }).deps.getToken = async () => 'denied';
    h.client.start();
    await h.flush();
    expect(h.sockets).toHaveLength(0);
    expect(h.states.at(-1)!.status).toBe('offline');
    expect(h.timers).toHaveLength(0);
  });

  it('retries when a token request fails for a moment', async () => {
    const h = harness();
    (h.client as unknown as { deps: RoomDeps }).deps.getToken = async () => null;
    h.client.start();
    await h.flush();
    expect(h.sockets).toHaveLength(0);
    expect(h.states.at(-1)!.status).toBe('reconnecting');
  });
});
