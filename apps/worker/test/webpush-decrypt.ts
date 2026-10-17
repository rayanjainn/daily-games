/**
 * Test-side implementation of what a browser does on receiving a push:
 * RFC 8291 (aes128gcm) decryption and RFC 8292 VAPID verification.
 * Lets us prove the payload our worker produces is correct without a real push service.
 */
const enc = new TextEncoder();

export const b64url = {
  encode(bytes: ArrayBuffer | Uint8Array): string {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = '';
    for (const b of u8) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): Uint8Array {
    const b64 = s
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(s.length / 4) * 4, '=');
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  },
};

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8),
  );
}

/** A fake browser subscription: P-256 keypair + 16-byte auth secret. */
export async function createBrowserSubscription(endpoint: string) {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(
    (await crypto.subtle.exportKey('raw', keys.publicKey)) as ArrayBuffer,
  );
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    subscription: {
      endpoint,
      expirationTime: null,
      keys: { p256dh: b64url.encode(publicRaw), auth: b64url.encode(auth) },
    },
    privateKey: keys.privateKey,
    publicRaw,
    auth,
  };
}

export async function decryptAes128gcm(
  body: Uint8Array,
  ua: { privateKey: CryptoKey; publicRaw: Uint8Array; auth: Uint8Array },
): Promise<string> {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  if (ciphertext.length > rs) throw new Error('multi-record payloads not expected');

  const asKey = await crypto.subtle.importKey(
    'raw',
    asPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      // workers-types names this field `$public`; the runtime takes the standard `public`.
      { name: 'ECDH', public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      ua.privateKey,
      256,
    ),
  );
  const keyInfo = concat(enc.encode('WebPush: info\0'), ua.publicRaw, asPublic);
  const ikm = await hkdf(ua.auth, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ciphertext),
  );
  // RFC 8188: strip trailing zero padding, then the 0x02 last-record delimiter.
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  if (padded[end] !== 2) throw new Error('missing last-record delimiter');
  return new TextDecoder().decode(padded.slice(0, end));
}

/** Verifies `Authorization: vapid t=<jwt>, k=<key>` and returns the JWT claims. */
export async function verifyVapid(authorization: string, expectedPublicKey: string) {
  const m = /^vapid t=([^,]+),\s*k=(.+)$/.exec(authorization);
  if (!m) throw new Error(`bad authorization header: ${authorization}`);
  const [, jwt, k] = m as unknown as [string, string, string];
  if (k !== expectedPublicKey) throw new Error('k does not match server public key');
  const [h, p, s] = jwt.split('.') as [string, string, string];
  const raw = b64url.decode(k);
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: b64url.encode(raw.slice(1, 33)),
      y: b64url.encode(raw.slice(33, 65)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    b64url.decode(s),
    enc.encode(`${h}.${p}`),
  );
  if (!ok) throw new Error('VAPID JWT signature invalid');
  return {
    header: JSON.parse(new TextDecoder().decode(b64url.decode(h))) as { alg: string },
    claims: JSON.parse(new TextDecoder().decode(b64url.decode(p))) as {
      aud: string;
      exp: number;
      sub: string;
    },
  };
}

export async function createVapidKeys(subject: string) {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const pub = (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  return { subject, publicKey: b64url.encode(pub), privateKey: jwk.d! };
}
