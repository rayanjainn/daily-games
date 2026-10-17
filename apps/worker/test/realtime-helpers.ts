import { SELF } from 'cloudflare:test';
import {
  importSigningKey,
  signInternalRequest,
  signRealtimeToken,
  type RealtimeClaims,
  type ServerMessage,
} from '@everydaily/shared/realtime';
import { inject } from 'vitest';

export async function mintToken(
  over: Partial<Pick<RealtimeClaims, 'sub' | 'name' | 'room' | 'perms'>> = {},
  opts: { now?: Date; ttl?: number } = {},
) {
  const key = await importSigningKey(inject('realtimePrivateKey'));
  const { token } = await signRealtimeToken(
    key,
    {
      sub: 'user-a',
      name: 'brave-otter-12',
      room: 'group:abc',
      perms: ['read', 'typing', 'presence'],
      ...over,
    },
    opts.now,
    opts.ttl,
  );
  return token;
}

export function upgrade(path: string, protocol: string | null) {
  const headers: Record<string, string> = { Upgrade: 'websocket' };
  if (protocol !== null) headers['Sec-WebSocket-Protocol'] = protocol;
  return SELF.fetch(`https://worker.test${path}`, { headers });
}

export class TestClient {
  readonly messages: ServerMessage[] = [];
  closed: { code: number; reason: string } | null = null;
  private waiters: (() => void)[] = [];

  constructor(readonly ws: WebSocket) {
    ws.accept();
    ws.addEventListener('message', (e) => {
      this.messages.push(JSON.parse(e.data as string));
      this.flush();
    });
    ws.addEventListener('close', (e) => {
      this.closed = { code: e.code, reason: e.reason };
      this.flush();
    });
  }

  static async connect(room = 'group:abc', claims: Parameters<typeof mintToken>[0] = {}) {
    const token = await mintToken({ room, ...claims });
    const res = await upgrade(`/rt/${room.replace(':', '/')}`, `ed.v1, auth.${token}`);
    if (res.status !== 101 || !res.webSocket) throw new Error(`upgrade failed: ${res.status}`);
    const client = new TestClient(res.webSocket);
    await client.waitFor((m) => m.t === 'hello');
    return client;
  }

  send(msg: unknown) {
    this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  /** Resolves with the first message (from the start of the log) that matches. */
  async waitFor<T extends ServerMessage>(
    pred: (m: ServerMessage) => boolean,
    timeoutMs = 2000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.messages.find(pred);
      if (hit) return hit as T;
      if (Date.now() > deadline) throw new Error(`timed out; got ${JSON.stringify(this.messages)}`);
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 50);
      });
    }
  }

  async waitForClose(timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    while (!this.closed) {
      if (Date.now() > deadline) throw new Error('socket did not close');
      await new Promise((r) => setTimeout(r, 20));
    }
    return this.closed;
  }

  close() {
    try {
      this.ws.close(1000, 'bye');
    } catch {
      // ignore
    }
  }

  private flush() {
    const w = this.waiters;
    this.waiters = [];
    for (const r of w) r();
  }
}

export async function broadcast(
  room: string,
  kind: string,
  data: unknown,
  secret = inject('broadcastSecret'),
) {
  const body = JSON.stringify({ room, kind, data });
  const res = await SELF.fetch('https://worker.test/internal/broadcast', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await signInternalRequest(secret, body)) },
    body,
  });
  // Always drain the body: an unread response stream keeps the room object referenced.
  return { status: res.status, body: await res.text() };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
