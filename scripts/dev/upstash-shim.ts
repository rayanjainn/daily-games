/**
 * Development/CI stand-in for Upstash Redis: speaks the Upstash REST protocol over HTTP and
 * forwards commands to a local Redis over RESP. Lets @upstash/redis and @upstash/ratelimit run
 * unchanged against `redis-server` (no Docker needed).
 *
 * Usage: pnpm dev:redis-shim
 *   env: SHIM_PORT=8079 REDIS_URL=redis://localhost:6379 REDIS_DB=0 SHIM_TOKEN=local-dev-token
 * Not for production.
 */
import { createServer } from 'node:http';
import { connect, type Socket } from 'node:net';

const PORT = Number(process.env.SHIM_PORT ?? 8079);
const TOKEN = process.env.SHIM_TOKEN ?? 'local-dev-token';
const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
/** Database index, from REDIS_DB or the URL path (redis://host:6379/1). */
const REDIS_DB = Number(process.env.REDIS_DB ?? (redisUrl.pathname.slice(1) || 0));

type Reply = string | number | null | Reply[] | { error: string };

class RespClient {
  private socket: Socket;
  private buffer = Buffer.alloc(0);
  private pending: ((r: Reply) => void)[] = [];

  constructor(host: string, port: number) {
    this.socket = connect(port, host);
    if (REDIS_DB) {
      this.pending.push(() => {});
      this.socket.write(encode(['SELECT', REDIS_DB]));
    }
    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      for (;;) {
        const parsed = parse(this.buffer, 0);
        if (!parsed) break;
        this.buffer = this.buffer.subarray(parsed.end);
        this.pending.shift()?.(parsed.value);
      }
    });
    this.socket.on('error', (err) => {
      console.error('redis connection error:', err.message);
      process.exit(1);
    });
  }

  /** Sends commands in one write so pipelines stay contiguous on the connection. */
  send(commands: (string | number)[][]): Promise<Reply[]> {
    const payload = commands.map((c) => encode(compatible(c))).join('');
    const promises = commands.map(
      () => new Promise<Reply>((resolve) => this.pending.push(resolve)),
    );
    this.socket.write(payload);
    return Promise.all(promises);
  }
}

function encode(cmd: (string | number)[]): string {
  let out = `*${cmd.length}\r\n`;
  for (const part of cmd) {
    const s = String(part);
    out += `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
  }
  return out;
}

function parse(buf: Buffer, start: number): { value: Reply; end: number } | null {
  const lineEnd = buf.indexOf('\r\n', start);
  if (lineEnd === -1) return null;
  const type = String.fromCharCode(buf[start]!);
  const line = buf.toString('utf8', start + 1, lineEnd);
  const next = lineEnd + 2;
  switch (type) {
    case '+':
      return { value: line, end: next };
    case '-':
      return { value: { error: line }, end: next };
    case ':':
      return { value: Number(line), end: next };
    case '$': {
      const len = Number(line);
      if (len === -1) return { value: null, end: next };
      if (buf.length < next + len + 2) return null;
      return { value: buf.toString('utf8', next, next + len), end: next + len + 2 };
    }
    case '*': {
      const count = Number(line);
      if (count === -1) return { value: null, end: next };
      const items: Reply[] = [];
      let pos = next;
      for (let i = 0; i < count; i++) {
        const item = parse(buf, pos);
        if (!item) return null;
        items.push(item.value);
        pos = item.end;
      }
      return { value: items, end: pos };
    }
    default:
      throw new Error(`unsupported RESP type ${type}`);
  }
}

const b64 = (r: Reply): Reply =>
  typeof r === 'string' ? Buffer.from(r).toString('base64') : Array.isArray(r) ? r.map(b64) : r;

function toUpstash(r: Reply, base64: boolean) {
  if (r && typeof r === 'object' && !Array.isArray(r)) return { error: r.error };
  return { result: base64 ? b64(r) : r };
}

/**
 * Upstash scripts declare `#!lua flags=allow-key-locking`, a flag stock Redis rejects. Strip it;
 * EVALSHA of the original hash then misses and the client falls back to EVAL, which is fine here.
 */
function compatible(cmd: (string | number)[]): (string | number)[] {
  const name = String(cmd[0]).toUpperCase();
  const scriptIndex =
    name === 'EVAL' || name === 'EVAL_RO'
      ? 1
      : name === 'SCRIPT' && String(cmd[1]).toUpperCase() === 'LOAD'
        ? 2
        : -1;
  if (scriptIndex === -1) return cmd;
  const script = String(cmd[scriptIndex]).replace(/^#!lua([^\n]*)\n/, (_m, rest: string) => {
    const flags =
      /flags=([\w,-]*)/
        .exec(rest)?.[1]
        ?.split(',')
        .filter((f) => f && f !== 'allow-key-locking') ?? [];
    return flags.length ? `#!lua flags=${flags.join(',')}\n` : '';
  });
  const copy = [...cmd];
  copy[scriptIndex] = script;
  return copy;
}

const redis = new RespClient(redisUrl.hostname, Number(redisUrl.port || 6379));

createServer(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401).end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  const base64 = String(req.headers['upstash-encoding'] ?? '').toLowerCase() === 'base64';
  try {
    const parsed = JSON.parse(body || '[]') as (string | number)[] | (string | number)[][];
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    res.setHeader('content-type', 'application/json');
    if (path === '/pipeline' || path === '/multi-exec') {
      const cmds = parsed as (string | number)[][];
      const wrapped = path === '/multi-exec' ? [['MULTI'], ...cmds, ['EXEC']] : cmds;
      const replies = await redis.send(wrapped);
      const results = path === '/multi-exec' ? ((replies.at(-1) as Reply[]) ?? []) : replies;
      res.end(JSON.stringify(results.map((r) => toUpstash(r, base64))));
      return;
    }
    const cmd =
      path === '/'
        ? (parsed as (string | number)[])
        : path.slice(1).split('/').map(decodeURIComponent);
    const [reply] = await redis.send([cmd]);
    const out = toUpstash(reply!, base64);
    res.writeHead('error' in out ? 400 : 200).end(JSON.stringify(out));
  } catch (err) {
    res.writeHead(400).end(JSON.stringify({ error: String(err) }));
  }
}).listen(PORT, () => console.log(`upstash shim on http://localhost:${PORT} → ${redisUrl.host}`));
