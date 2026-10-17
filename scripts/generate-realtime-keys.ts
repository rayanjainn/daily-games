/**
 * Generates the Ed25519 key pair for realtime tokens and a broadcast secret.
 * Usage: pnpm tsx scripts/generate-realtime-keys.ts
 *   web (Vercel):    REALTIME_SIGNING_KEY, INTERNAL_BROADCAST_SECRET
 *   worker (secret): REALTIME_PUBLIC_KEY, INTERNAL_BROADCAST_SECRET
 */
const b64url = (b: ArrayBuffer) => Buffer.from(b).toString('base64url');
const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
  'sign',
  'verify',
])) as CryptoKeyPair;

console.log(
  `REALTIME_SIGNING_KEY=${b64url((await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer)}`,
);
console.log(
  `REALTIME_PUBLIC_KEY=${b64url((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)}`,
);
console.log(
  `INTERNAL_BROADCAST_SECRET=${b64url(crypto.getRandomValues(new Uint8Array(32)).buffer)}`,
);
