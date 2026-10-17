import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineProject } from 'vitest/config';

// Fresh Ed25519 keys per test run; nothing secret is committed. (Inlined rather than imported
// from @everydaily/shared because this file is loaded by Node's ESM loader, not the bundler.)
const b64url = (b: ArrayBuffer) => Buffer.from(b).toString('base64url');
const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
  'sign',
  'verify',
])) as CryptoKeyPair;
const realtimeKeys = {
  privateKey: b64url((await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer),
  publicKey: b64url((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer),
};
const broadcastSecret = crypto.randomUUID();

export default defineProject({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          REALTIME_PUBLIC_KEY: realtimeKeys.publicKey,
          INTERNAL_BROADCAST_SECRET: broadcastSecret,
        },
      },
    }),
  ],
  test: {
    name: 'worker',
    include: ['test/**/*.test.ts'],
    provide: {
      realtimePrivateKey: realtimeKeys.privateKey,
      broadcastSecret,
    },
  },
});
