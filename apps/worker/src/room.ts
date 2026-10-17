import { DurableObject } from 'cloudflare:workers';
import {
  CloseCode,
  REAUTH_INTERVAL_SECONDS,
  REALTIME_SUBPROTOCOL,
  RING_BUFFER_SIZE,
  clientMessageSchema,
  importVerifyKey,
  verifyRealtimeToken,
  type PresenceUser,
  type RealtimeClaims,
  type ServerMessage,
} from '@everydaily/shared/realtime';
import type { Env } from './env';

/** Per-socket state; survives hibernation via serializeAttachment. */
interface Attachment {
  userId: string;
  name: string;
  perms: RealtimeClaims['perms'];
  reauthBy: number; // epoch ms
  lastTypingAt: number;
}

const MAX_FRAME_BYTES = 4096;
const TYPING_MIN_INTERVAL_MS = 3000;
const TYPING_TTL_MS = 5000;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * One instance per room (`community:<id>`, `group:<id>`, `thread:<id>`).
 * Uses the WebSocket Hibernation API: no in-memory state is trusted across wake-ups; presence is
 * rebuilt from socket attachments and ordering state lives in SQLite storage.
 */
export class RoomDO extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS used_jti (jti TEXT PRIMARY KEY, exp INTEGER NOT NULL);
    `);
    // Answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  // ---- HTTP entry points (only reachable from this worker's fetch handler) ----

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/connect') return this.acceptConnection(request);
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const { kind, data } = (await request.json()) as { kind: string; data: unknown };
      const seq = this.publish(kind, data);
      return Response.json({ seq, delivered: this.sockets().length });
    }
    return new Response('Not found', { status: 404 });
  }

  private acceptConnection(request: Request): Response {
    const claims = JSON.parse(
      request.headers.get('x-ed-claims') ?? 'null',
    ) as RealtimeClaims | null;
    if (!claims) return new Response('Missing claims', { status: 400 });

    this.setMeta('room', claims.room);
    if (!this.consumeJti(claims.jti, claims.exp)) {
      return new Response('Token already used', { status: 401 });
    }

    const alreadyPresent = this.presence().some((p) => p.userId === claims.sub);
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [claims.sub]);
    const attachment: Attachment = {
      userId: claims.sub,
      name: claims.name,
      perms: claims.perms,
      reauthBy: Date.now() + REAUTH_INTERVAL_SECONDS * 1000,
      lastTypingAt: 0,
    };
    server.serializeAttachment(attachment);

    this.send(server, { t: 'hello', seq: this.currentSeq(), presence: this.presence() });
    if (!alreadyPresent && claims.perms.includes('presence')) {
      this.broadcastExcept(server, {
        t: 'presence',
        joined: { userId: claims.sub, name: claims.name },
      });
    }
    void this.ensureSweep();

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': REALTIME_SUBPROTOCOL },
    });
  }

  // ---- Hibernation handlers ----

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment;
    if (Date.now() > att.reauthBy)
      return this.closeSocket(ws, CloseCode.ReauthRequired, 'reauth required');
    if (typeof raw !== 'string' || raw.length > MAX_FRAME_BYTES) {
      return this.closeSocket(ws, CloseCode.BadMessage, 'bad frame');
    }

    let parsed: ReturnType<typeof clientMessageSchema.safeParse>;
    try {
      parsed = clientMessageSchema.safeParse(JSON.parse(raw));
    } catch {
      return this.closeSocket(ws, CloseCode.BadMessage, 'invalid json');
    }
    if (!parsed.success) return this.send(ws, { t: 'error', code: 'bad_message' });
    const msg = parsed.data;

    switch (msg.t) {
      case 'typing': {
        if (!att.perms.includes('typing')) return this.send(ws, { t: 'error', code: 'forbidden' });
        const now = Date.now();
        if (now - att.lastTypingAt < TYPING_MIN_INTERVAL_MS) return; // silently throttled
        ws.serializeAttachment({ ...att, lastTypingAt: now });
        this.broadcastExcept(ws, {
          t: 'typing',
          userId: att.userId,
          name: att.name,
          until: now + TYPING_TTL_MS,
        });
        return;
      }
      case 'resume':
        return this.replay(ws, msg.since);
      case 'reauth':
        return this.reauth(ws, att, msg.token);
    }
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.onDisconnect(ws);
    try {
      ws.close(code === 1005 ? 1000 : code, reason);
    } catch {
      // already closed
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.onDisconnect(ws);
  }

  /** Periodic sweep: closes sockets that missed their reauth deadline. */
  override async alarm(): Promise<void> {
    const now = Date.now();
    for (const ws of this.sockets()) {
      const att = ws.deserializeAttachment() as Attachment;
      if (now > att.reauthBy) this.closeSocket(ws, CloseCode.ReauthRequired, 'reauth required');
    }
    this.sql.exec('DELETE FROM used_jti WHERE exp < ?', Math.floor(now / 1000) - 60);
    if (this.sockets().length > 0) await this.ctx.storage.setAlarm(now + SWEEP_INTERVAL_MS);
  }

  // ---- internals ----

  private async reauth(ws: WebSocket, att: Attachment, token: string) {
    const key = await importVerifyKey(this.env.REALTIME_PUBLIC_KEY);
    const res = await verifyRealtimeToken(key, token);
    if (
      !res.ok ||
      res.claims.sub !== att.userId ||
      res.claims.room !== this.getMeta('room') ||
      !this.consumeJti(res.claims.jti, res.claims.exp)
    ) {
      return this.closeSocket(ws, CloseCode.ReauthRequired, 'reauth failed');
    }
    const reauthBy = Date.now() + REAUTH_INTERVAL_SECONDS * 1000;
    ws.serializeAttachment({ ...att, perms: res.claims.perms, reauthBy });
    this.send(ws, { t: 'reauthed', until: reauthBy });
  }

  private publish(kind: string, data: unknown): number {
    const seq = this.currentSeq() + 1;
    const msg: ServerMessage = { t: 'event', seq, kind, data };
    const body = JSON.stringify(msg);
    this.sql.exec('INSERT INTO events (seq, body) VALUES (?, ?)', seq, body);
    this.sql.exec('DELETE FROM events WHERE seq <= ?', seq - RING_BUFFER_SIZE);
    this.setMeta('seq', String(seq));
    for (const ws of this.sockets()) this.sendRaw(ws, body);
    return seq;
  }

  private replay(ws: WebSocket, since: number) {
    const current = this.currentSeq();
    if (since >= current) return;
    const oldest = this.sql.exec<{ seq: number }>('SELECT MIN(seq) AS seq FROM events').one().seq;
    if (oldest === null || since < oldest - 1) return this.send(ws, { t: 'resync' });
    const rows = this.sql.exec<{ body: string }>(
      'SELECT body FROM events WHERE seq > ? ORDER BY seq',
      since,
    );
    for (const row of rows) this.sendRaw(ws, row.body);
  }

  private onDisconnect(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    const stillPresent = this.sockets().some(
      (other) =>
        other !== ws && (other.deserializeAttachment() as Attachment).userId === att.userId,
    );
    if (!stillPresent && att.perms.includes('presence')) {
      this.broadcastExcept(ws, { t: 'presence', left: { userId: att.userId, name: att.name } });
    }
  }

  private consumeJti(jti: string, exp: number): boolean {
    const hit = this.sql.exec('SELECT 1 FROM used_jti WHERE jti = ?', jti).toArray().length > 0;
    if (hit) return false;
    this.sql.exec('INSERT INTO used_jti (jti, exp) VALUES (?, ?)', jti, exp);
    return true;
  }

  private presence(): PresenceUser[] {
    const seen = new Map<string, PresenceUser>();
    for (const ws of this.sockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att && att.perms.includes('presence'))
        seen.set(att.userId, { userId: att.userId, name: att.name });
    }
    return [...seen.values()];
  }

  private sockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  private currentSeq(): number {
    return Number(this.getMeta('seq') ?? 0);
  }

  private getMeta(k: string): string | null {
    const rows = this.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', k).toArray();
    return rows[0]?.v ?? null;
  }

  private setMeta(k: string, v: string) {
    this.sql.exec(
      'INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
      k,
      v,
    );
  }

  private async ensureSweep() {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    this.sendRaw(ws, JSON.stringify(msg));
  }

  private sendRaw(ws: WebSocket, body: string) {
    try {
      ws.send(body);
    } catch {
      // socket went away between listing and sending; close handler will clean up
    }
  }

  private broadcastExcept(except: WebSocket, msg: ServerMessage) {
    const body = JSON.stringify(msg);
    for (const ws of this.sockets()) if (ws !== except) this.sendRaw(ws, body);
  }

  private closeSocket(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }
}
