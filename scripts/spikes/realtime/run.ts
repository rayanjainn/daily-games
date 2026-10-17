/**
 * Spike: Durable Object room authenticated by a token minted by the Next.js app.
 * Starts `wrangler dev` and `next dev`, then drives two clients over real WebSockets.
 *
 * Usage: pnpm tsx scripts/spikes/realtime/run.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

const root = join(new URL('.', import.meta.url).pathname, '../../..');
const WORKER_PORT = 8789;
const WEB_PORT = 3100;
const ROOM = 'group:spike-room';

const b64url = (b: ArrayBuffer) => Buffer.from(b).toString('base64url');
const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
  'sign',
  'verify',
])) as CryptoKeyPair;
const privateKey = b64url(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
const secret = crypto.randomUUID();

const procs: ChildProcess[] = [];
function start(
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  ready: RegExp,
) {
  const p = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  procs.push(p);
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${args.join(' ')} did not start`)), 120_000);
    const on = (d: Buffer) => {
      if (process.env.SPIKE_VERBOSE) process.stderr.write(d);
      if (ready.test(d.toString())) {
        clearTimeout(t);
        resolve();
      }
    };
    p.stdout!.on('data', on);
    p.stderr!.on('data', on);
  });
}

const checks: [string, boolean][] = [];
const check = (name: string, ok: boolean) => {
  checks.push([name, ok]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

class Client {
  msgs: { t: string; [k: string]: unknown }[] = [];
  ws: WebSocket;
  closed: { code: number } | null = null;
  constructor(url: string, token: string) {
    this.ws = new WebSocket(url, ['ed.v1', `auth.${token}`]);
    this.ws.onmessage = (e) => this.msgs.push(JSON.parse(String(e.data)));
    this.ws.onclose = (e) => (this.closed = { code: e.code });
  }
  opened() {
    return new Promise<boolean>((resolve) => {
      this.ws.onopen = () => resolve(true);
      this.ws.onerror = () => resolve(false);
    });
  }
  async waitFor(pred: (m: Client['msgs'][number]) => boolean, ms = 5000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = this.msgs.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  }
}

async function token(userId: string, username: string, room = ROOM) {
  const res = await fetch(`http://localhost:${WEB_PORT}/api/realtime/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dev-user-id': userId,
      'x-dev-username': username,
    },
    body: JSON.stringify({ room }),
  });
  return {
    status: res.status,
    body: (await res.json()) as { token: string; url: string; expiresIn: number },
  };
}

let exitCode = 0;
try {
  await Promise.all([
    start(
      'pnpm',
      [
        'exec',
        'wrangler',
        'dev',
        '--port',
        String(WORKER_PORT),
        '--var',
        `REALTIME_PUBLIC_KEY:${publicKey}`,
        '--var',
        `INTERNAL_BROADCAST_SECRET:${secret}`,
      ],
      join(root, 'apps/worker'),
      {},
      /Ready on/,
    ),
    start(
      'pnpm',
      ['exec', 'next', 'dev', '--port', String(WEB_PORT)],
      join(root, 'apps/web'),
      {
        REALTIME_URL: `ws://localhost:${WORKER_PORT}`,
        WORKER_INTERNAL_URL: `http://localhost:${WORKER_PORT}`,
        REALTIME_SIGNING_KEY: privateKey,
        INTERNAL_BROADCAST_SECRET: secret,
      },
      /Ready in|ready started|Local:/,
    ),
  ]);

  const unauth = await fetch(`http://localhost:${WEB_PORT}/api/realtime/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ room: ROOM }),
  });
  check('token endpoint refuses anonymous callers (401)', unauth.status === 401);

  const ta = await token('user-a', 'brave_otter');
  check(
    'Next.js mints a token for a signed-in user',
    ta.status === 200 && ta.body.expiresIn === 60,
  );

  const a = new Client(ta.body.url, ta.body.token);
  check('client A connects with the token', await a.opened());
  const helloA = await a.waitFor((m) => m.t === 'hello');
  check(
    'client A receives hello with itself in presence',
    JSON.stringify(helloA?.presence) ===
      JSON.stringify([{ userId: 'user-a', name: 'brave_otter' }]),
  );

  const tb = await token('user-b', 'calm_fox');
  const b = new Client(tb.body.url, tb.body.token);
  check('client B connects', await b.opened());
  check(
    'A sees B join',
    !!(await a.waitFor(
      (m) => m.t === 'presence' && (m.joined as { userId: string })?.userId === 'user-b',
    )),
  );

  a.ws.send(JSON.stringify({ t: 'typing' }));
  check('B sees A typing', !!(await b.waitFor((m) => m.t === 'typing' && m.userId === 'user-a')));

  for (let i = 1; i <= 3; i++) {
    await fetch(`http://localhost:${WEB_PORT}/api/dev/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: ROOM, kind: 'comment.created', data: { i } }),
    });
  }
  const gotAll = await b.waitFor((m) => m.t === 'event' && m.seq === 3);
  const seqs = (c: Client) =>
    c.msgs
      .filter((m) => m.t === 'event')
      .map((m) => m.seq)
      .join(',');
  check(
    'events published by Next.js arrive in order at both clients',
    !!gotAll && seqs(a) === '1,2,3' && seqs(b) === '1,2,3',
  );

  const replay = new Client(ta.body.url, ta.body.token);
  check('replaying a used token is refused', !(await replay.opened()));

  const other = await token('user-c', 'sly_crow', 'group:other-room');
  const wrongRoom = new Client(ta.body.url, other.body.token);
  check('token for another room is refused', !(await wrongRoom.opened()));

  const pingReply = new Promise<boolean>((resolve) => {
    const h = (e: MessageEvent) => {
      if (String(e.data) === '{"t":"pong"}') {
        a.ws.removeEventListener('message', h);
        resolve(true);
      }
    };
    a.ws.addEventListener('message', h);
    setTimeout(() => resolve(false), 3000);
  });
  a.ws.send('{"t":"ping"}');
  check('ping is auto-answered', await pingReply);

  b.ws.close(1000);
  check(
    'A sees B leave',
    !!(await a.waitFor(
      (m) => m.t === 'presence' && (m.left as { userId: string })?.userId === 'user-b',
    )),
  );
  a.ws.close(1000);
} catch (err) {
  console.error('SPIKE FAILED:', err);
  exitCode = 1;
} finally {
  for (const p of procs) p.kill('SIGTERM');
}
if (checks.some(([, ok]) => !ok)) exitCode = 1;
console.log(`\n${checks.filter(([, ok]) => ok).length}/${checks.length} checks passed`);
process.exit(exitCode);
