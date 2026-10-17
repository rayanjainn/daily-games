/// <reference lib="webworker" />
/**
 * Proof-of-work solver (see server/auth/pow.ts). Runs off the main thread.
 */
const enc = new TextEncoder();

function leadingZeroBits(buf: ArrayBuffer): number {
  const bytes = new Uint8Array(buf);
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(b) - 24;
  }
  return bits;
}

self.onmessage = async (e: MessageEvent<{ salt: string; difficulty: number }>) => {
  const { salt, difficulty } = e.data;
  for (let nonce = 0; nonce < 50_000_000; nonce++) {
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${nonce}`));
    if (leadingZeroBits(digest) >= difficulty) {
      (self as unknown as Worker).postMessage({ nonce: String(nonce) });
      return;
    }
  }
  (self as unknown as Worker).postMessage({ error: 'not_found' });
};
