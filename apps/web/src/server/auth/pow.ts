import 'server-only';
import { createHash } from 'node:crypto';
import { env } from '../env';
import { randomToken } from '../crypto';
import { redis } from '../redis';

/**
 * Hashcash-style proof of work: find `nonce` such that sha256(`${salt}:${nonce}`) starts with
 * `difficulty` zero bits. ~65k hashes at difficulty 16 (well under two seconds on a phone).
 * Challenges are stored server-side, expire quickly and can be used once.
 */
const TTL_SECONDS = 300;

export interface PowChallenge {
  id: string;
  salt: string;
  difficulty: number;
}

export async function issuePow(): Promise<PowChallenge> {
  const challenge = {
    id: randomToken(12),
    salt: randomToken(16),
    difficulty: env('bot').POW_DIFFICULTY,
  };
  await redis().set(`pow:${challenge.id}`, challenge, { ex: TTL_SECONDS });
  return challenge;
}

export function leadingZeroBits(buf: Buffer): number {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

export function checkPow(salt: string, nonce: string, difficulty: number): boolean {
  if (!/^[0-9]{1,12}$/.test(nonce)) return false;
  return leadingZeroBits(createHash('sha256').update(`${salt}:${nonce}`).digest()) >= difficulty;
}

/** Consumes the challenge (single use) and checks the solution. */
export async function redeemPow(id: string, nonce: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(id)) return false;
  const challenge = await redis().getdel<PowChallenge>(`pow:${id}`);
  if (!challenge) return false;
  return checkPow(challenge.salt, nonce, challenge.difficulty);
}
