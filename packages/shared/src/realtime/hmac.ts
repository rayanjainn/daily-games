/**
 * Request signing for web app → worker internal calls.
 * Signature = hex(HMAC-SHA256(secret, `${timestamp}.${body}`)), timestamp in unix seconds.
 */
const enc = new TextEncoder();
export const SIGNATURE_HEADER = 'x-ed-signature';
export const TIMESTAMP_HEADER = 'x-ed-timestamp';
const MAX_AGE_SECONDS = 60;

async function key(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

const toHex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

export async function signInternalRequest(secret: string, body: string, now = new Date()) {
  const ts = String(Math.floor(now.getTime() / 1000));
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(`${ts}.${body}`));
  return { [SIGNATURE_HEADER]: toHex(sig), [TIMESTAMP_HEADER]: ts };
}

export async function verifyInternalRequest(
  secret: string,
  body: string,
  signature: string | null,
  timestamp: string | null,
  now = new Date(),
): Promise<boolean> {
  if (
    !signature ||
    !timestamp ||
    !/^\d{1,12}$/.test(timestamp) ||
    !/^[0-9a-f]{64}$/.test(signature)
  )
    return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp)) > MAX_AGE_SECONDS)
    return false;
  const sigBytes = new Uint8Array(signature.match(/../g)!.map((h) => parseInt(h, 16)));
  // crypto.subtle.verify compares in constant time.
  return crypto.subtle.verify(
    'HMAC',
    await key(secret),
    sigBytes,
    enc.encode(`${timestamp}.${body}`),
  );
}
