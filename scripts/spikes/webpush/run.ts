/**
 * Spike: real end-to-end web push.
 * Chromium subscribes through its real push service, the worker (wrangler dev) encrypts and
 * sends, and the service worker reports the decrypted payload back to this script.
 *
 * Usage: xvfb-run -a pnpm tsx scripts/spikes/webpush/run.ts
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const dir = new URL('.', import.meta.url).pathname;
const PAGE_PORT = 4173;
const WORKER_PORT = 8788;

const b64url = (b: ArrayBuffer) => Buffer.from(b).toString('base64url');
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
]);
const vapidPublic = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
const vapidPrivate = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!;

let resolveReceived: (v: unknown) => void;
const received = new Promise((r) => (resolveReceived = r));

const server = createServer((req, res) => {
  if (req.url === '/received') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      resolveReceived(JSON.parse(body));
      res.end('ok');
    });
    return;
  }
  const file = req.url === '/sw.js' ? 'sw.js' : 'index.html';
  res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
  res.end(readFileSync(join(dir, file)));
}).listen(PAGE_PORT);

const worker = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--port',
    String(WORKER_PORT),
    '--var',
    'DEV_ROUTES:1',
    '--var',
    `VAPID_PUBLIC_KEY:${vapidPublic}`,
    '--var',
    `VAPID_PRIVATE_KEY:${vapidPrivate}`,
  ],
  { cwd: join(dir, '../../../apps/worker'), stdio: ['ignore', 'pipe', 'pipe'] },
);
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('wrangler dev did not start')), 60_000);
  const onData = (d: Buffer) => {
    if (d.toString().includes('Ready on')) {
      clearTimeout(t);
      resolve();
    }
  };
  worker.stdout.on('data', onData);
  worker.stderr.on('data', onData);
  if (process.env.SPIKE_VERBOSE) {
    worker.stdout.pipe(process.stderr);
    worker.stderr.pipe(process.stderr);
  }
});

const proxy = process.env.HTTPS_PROXY;
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'push-')), {
  executablePath: '/opt/pw-browsers/chromium',
  headless: false,
  args: proxy ? [`--proxy-server=${proxy}`, '--ignore-certificate-errors'] : [],
  permissions: ['notifications'],
});

let exitCode = 0;
try {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PAGE_PORT}/`);
  const subscription = await page.evaluate(
    (k) =>
      (window as unknown as { subscribe: (k: string) => Promise<PushSubscriptionJSON> }).subscribe(
        k,
      ),
    vapidPublic,
  );
  const endpoint = subscription.endpoint!;
  console.log('push service:', new URL(endpoint).host);

  // RELAY=1: the worker encrypts and signs, this script performs the HTTP send. Needed where
  // the local runtime cannot reach the internet directly (sandboxed CI behind a proxy).
  const relay = process.env.RELAY === '1';
  const res = await fetch(`http://localhost:${WORKER_PORT}/dev/push${relay ? '-request' : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription, title: 'Spike', body: 'Hello from the worker' }),
  });
  if (relay) {
    const built = (await res.json()) as { headers: Record<string, string>; body: string };
    const sent = await fetch(endpoint, {
      method: 'POST',
      headers: built.headers,
      body: Buffer.from(built.body, 'base64'),
    });
    console.log('push service response:', sent.status, (await sent.text()).slice(0, 300));
  } else {
    console.log('worker outcome:', res.status, (await res.text()).slice(0, 300));
  }

  const payload = await Promise.race([
    received,
    new Promise((_, rej) => setTimeout(() => rej(new Error('no push within 60s')), 60_000)),
  ]);
  console.log('service worker received:', payload);
} catch (err) {
  console.error('SPIKE FAILED:', err);
  exitCode = 1;
} finally {
  await context.close();
  worker.kill();
  server.close();
}
process.exit(exitCode);
