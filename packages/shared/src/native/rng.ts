/**
 * A small deterministic random number generator (sfc32) for the native games. A puzzle is a
 * pure function of its seed, so the server can rebuild it on any request and tests can pin it.
 * Not for anything secret: the secrecy comes from the seed, which the server derives with a key.
 */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, n). */
  int(n: number): number;
  /** A shuffled copy (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** One element. */
  pick<T>(items: readonly T[]): T;
}

/** Builds a generator from at least 16 seed bytes (e.g. the start of an HMAC). */
export function rngFromBytes(bytes: Uint8Array): Rng {
  if (bytes.length < 16) throw new Error('seed needs at least 16 bytes');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let a = view.getUint32(0);
  let b = view.getUint32(4);
  let c = view.getUint32(8);
  let d = view.getUint32(12);
  const step = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // Mix the seed in before the first output.
  for (let i = 0; i < 15; i++) step();
  const next = () => step() / 4294967296;
  const int = (n: number) => {
    if (!Number.isInteger(n) || n < 1) throw new Error('int needs a positive integer');
    return Math.floor(next() * n);
  };
  return {
    next,
    int,
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    pick<T>(items: readonly T[]): T {
      if (!items.length) throw new Error('nothing to pick from');
      return items[int(items.length)]!;
    },
  };
}

/** A seed for tests and examples: the bytes of a short string, repeated to 16. */
export function seedFromString(s: string): Uint8Array {
  const out = new Uint8Array(16);
  const bytes = new TextEncoder().encode(s || ' ');
  for (let i = 0; i < 16; i++) out[i] = bytes[i % bytes.length]! ^ (i * 31);
  return out;
}
