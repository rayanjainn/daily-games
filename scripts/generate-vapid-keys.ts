/**
 * Generates a VAPID key pair for web push.
 * Usage: pnpm keys:vapid
 * Put VAPID_PUBLIC_KEY in the web app env (it is public) and both keys in the worker secrets.
 */
const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url');

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const publicRaw = await crypto.subtle.exportKey('raw', pair.publicKey);
const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${b64url(publicRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${privateJwk.d}`);

export {};
