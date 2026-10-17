/**
 * Browser side of the realtime protocol (PLAN.md section 10), without React so it can be tested
 * with a fake socket. One RoomClient per open room:
 *  - fetches a short-lived token and connects with it in Sec-WebSocket-Protocol,
 *  - remembers the last event seq and asks the room to replay from it after a reconnect,
 *  - reconnects with exponential backoff and full jitter (0.5 s up to 30 s),
 *  - re-authenticates before the room's deadline, and stops for good when access is refused.
 */
import {
  AUTH_PROTOCOL_PREFIX,
  CloseCode,
  REALTIME_SUBPROTOCOL,
  REAUTH_INTERVAL_SECONDS,
  type PresenceUser,
  type ServerMessage,
} from '@everydaily/shared/realtime';

export type RoomStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface RoomState {
  status: RoomStatus;
  presence: PresenceUser[];
  /** Players typing right now (their entries expire on their own). */
  typing: { userId: string; name: string; until: number }[];
}

export interface RoomEvents {
  onState(state: RoomState): void;
  /** A new event, in order and at most once; `resync` means refetch everything over HTTP. */
  onEvent(kind: string, data: unknown): void;
}

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number }) => void) | null;
}

export interface RoomDeps {
  /** null = try again later; 'denied' = this room (or realtime) isn't available, stop trying. */
  getToken(room: string): Promise<{ token: string; url: string } | null | 'denied'>;
  openSocket(url: string, protocols: string[]): SocketLike;
  now(): number;
  random(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;
const TYPING_THROTTLE_MS = 3_000;
/** Refresh the token well before the room's 10-minute deadline. */
const REAUTH_EVERY_MS = (REAUTH_INTERVAL_SECONDS - 60) * 1000;

/** Full-jitter backoff: a random wait between 0 and min(cap, base·2^attempt). */
export function backoffDelay(attempt: number, random: () => number): number {
  return Math.floor(random() * Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt));
}

export class RoomClient {
  private socket: SocketLike | null = null;
  private seq = 0;
  private attempt = 0;
  private stopped = false;
  private retryTimer: unknown = null;
  private reauthTimer: unknown = null;
  private lastTyping = Number.NEGATIVE_INFINITY;
  private state: RoomState = { status: 'connecting', presence: [], typing: [] };

  constructor(
    private readonly room: string,
    private readonly events: RoomEvents,
    private readonly deps: RoomDeps,
  ) {}

  start() {
    this.stopped = false;
    void this.connect();
  }

  stop() {
    this.stopped = true;
    this.deps.clearTimeout(this.retryTimer);
    this.deps.clearTimeout(this.reauthTimer);
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onclose = null;
      s.close(1000);
    }
  }

  /** Tells the room you are typing; throttled so a fast typist sends one message per 3 s. */
  typing() {
    const now = this.deps.now();
    if (now - this.lastTyping < TYPING_THROTTLE_MS || this.socket?.readyState !== 1) return;
    this.lastTyping = now;
    this.socket.send(JSON.stringify({ t: 'typing' }));
  }

  private set(patch: Partial<RoomState>) {
    const now = this.deps.now();
    this.state = { ...this.state, ...patch };
    this.state.typing = this.state.typing.filter((t) => t.until > now);
    this.events.onState(this.state);
  }

  private async connect() {
    if (this.stopped) return;
    this.set({ status: this.attempt === 0 ? 'connecting' : 'reconnecting' });
    let auth: { token: string; url: string } | null | 'denied' = null;
    try {
      auth = await this.deps.getToken(this.room);
    } catch {
      auth = null;
    }
    if (this.stopped) return;
    if (auth === 'denied') {
      this.stopped = true;
      this.set({ status: 'offline', presence: [] });
      return;
    }
    if (!auth) return this.retry();
    const socket = this.deps.openSocket(auth.url, [
      REALTIME_SUBPROTOCOL,
      `${AUTH_PROTOCOL_PREFIX}${auth.token}`,
    ]);
    this.socket = socket;
    socket.onmessage = (e) => this.receive(e.data);
    socket.onclose = (e) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.deps.clearTimeout(this.reauthTimer);
      if (e.code === CloseCode.Forbidden) {
        // No access to this room (left the group, post removed): don't keep knocking.
        this.stopped = true;
        this.set({ status: 'offline', presence: [] });
        return;
      }
      this.retry();
    };
  }

  private retry() {
    if (this.stopped) return;
    this.set({ status: 'reconnecting', presence: [] });
    const delay = backoffDelay(this.attempt, this.deps.random);
    this.attempt = Math.min(this.attempt + 1, 10);
    this.retryTimer = this.deps.setTimeout(() => void this.connect(), delay);
  }

  private scheduleReauth() {
    this.deps.clearTimeout(this.reauthTimer);
    this.reauthTimer = this.deps.setTimeout(async () => {
      const auth = await this.deps.getToken(this.room).catch(() => null);
      if (auth && auth !== 'denied' && this.socket?.readyState === 1) {
        this.socket.send(JSON.stringify({ t: 'reauth', token: auth.token }));
      }
      this.scheduleReauth();
    }, REAUTH_EVERY_MS);
  }

  private receive(raw: unknown) {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(raw)) as ServerMessage;
    } catch {
      return;
    }
    switch (msg.t) {
      case 'hello': {
        this.attempt = 0;
        this.scheduleReauth();
        // Anything published while we were away: ask for it from where we left off.
        if (this.seq > 0 && msg.seq > this.seq)
          this.socket?.send(JSON.stringify({ t: 'resume', since: this.seq }));
        else this.seq = Math.max(this.seq, msg.seq);
        this.set({ status: 'live', presence: msg.presence });
        break;
      }
      case 'event':
        if (msg.seq <= this.seq) return;
        this.seq = msg.seq;
        this.events.onEvent(msg.kind, msg.data);
        break;
      case 'resync':
        this.events.onEvent('resync', null);
        break;
      case 'presence': {
        let presence = this.state.presence;
        if (msg.joined && !presence.some((p) => p.userId === msg.joined!.userId))
          presence = [...presence, msg.joined];
        if (msg.left) presence = presence.filter((p) => p.userId !== msg.left!.userId);
        this.set({ presence });
        break;
      }
      case 'typing':
        this.set({
          typing: [
            ...this.state.typing.filter((t) => t.userId !== msg.userId),
            { userId: msg.userId, name: msg.name, until: msg.until },
          ],
        });
        break;
      default:
        break;
    }
  }
}
