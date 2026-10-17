import 'server-only';
import { hash, verify } from '@node-rs/argon2';
import { randomInt } from 'node:crypto';
import { hmac, safeEqual } from '../crypto';
import { redis } from '../redis';
import { BIP39_ENGLISH } from './wordlists/bip39';

/** 6 words × 11 bits = 66 bits of entropy. */
export const PHRASE_WORDS = 6;

const WORDS = new Set(BIP39_ENGLISH);
/** BIP39 words are unique in their first four letters, so prefixes can be expanded. */
const BY_PREFIX = new Map(BIP39_ENGLISH.map((w) => [w.slice(0, 4), w]));

// argon2id, OWASP-recommended parameters (64 MiB, 3 passes).
const ARGON = { algorithm: 2, memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;

export function generatePhrase(): string[] {
  return Array.from(
    { length: PHRASE_WORDS },
    () => BIP39_ENGLISH[randomInt(BIP39_ENGLISH.length)]!,
  );
}

/** Lowercases, splits on spaces/commas/dashes and expands 4-letter prefixes. Null if invalid. */
export function normalizePhrase(input: string): string[] | null {
  const parts = input
    .normalize('NFKC')
    .toLowerCase()
    .split(/[\s,.;:\-–—]+/)
    .filter(Boolean)
    .map((w) => w.replace(/^\d+[.)]?/, ''))
    .filter(Boolean);
  if (parts.length !== PHRASE_WORDS) return null;
  const words = parts.map((w) =>
    WORDS.has(w) ? w : w.length >= 4 ? (BY_PREFIX.get(w.slice(0, 4)) ?? null) : null,
  );
  return words.every(Boolean) ? (words as string[]) : null;
}

export function hashPhrase(words: string[]): Promise<string> {
  return hash(words.join(' '), ARGON);
}

let dummyHash: Promise<string> | null = null;
/** Verifies a phrase; with no stored hash it still does the same work, to hide whether the user exists. */
export async function verifyPhrase(
  stored: string | null,
  words: string[] | null,
): Promise<boolean> {
  dummyHash ??= hash('decoy decoy decoy decoy decoy decoy', ARGON);
  const target = stored ?? (await dummyHash);
  const candidate = (words ?? ['x']).join(' ');
  const ok = await verify(target, candidate).catch(() => false);
  return ok && stored !== null && words !== null;
}

// ---------------------------------------------------------------------------
// Lockout with exponential backoff, tracked per username and per IP.
// ---------------------------------------------------------------------------

const FREE_ATTEMPTS = 5;
const BASE_LOCK_SECONDS = 60;
const MAX_LOCK_SECONDS = 24 * 3600;

interface FailState {
  fails: number;
  lockedUntil: number; // epoch ms
}

const failKey = (scope: 'u' | 'ip', id: string) => `recover-fail:${scope}:${id}`;

export async function lockedFor(username: string, ip: string): Promise<number> {
  const [u, i] = await Promise.all([
    redis().get<FailState>(failKey('u', username)),
    redis().get<FailState>(failKey('ip', ip)),
  ]);
  const until = Math.max(u?.lockedUntil ?? 0, i?.lockedUntil ?? 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function lockSecondsAfter(fails: number): number {
  if (fails < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_LOCK_SECONDS, BASE_LOCK_SECONDS * 2 ** (fails - FREE_ATTEMPTS));
}

export async function recordFailure(username: string, ip: string) {
  for (const key of [failKey('u', username), failKey('ip', ip)]) {
    const state = (await redis().get<FailState>(key)) ?? { fails: 0, lockedUntil: 0 };
    const fails = state.fails + 1;
    const lock = lockSecondsAfter(fails);
    await redis().set<FailState>(
      key,
      { fails, lockedUntil: lock ? Date.now() + lock * 1000 : 0 },
      { ex: MAX_LOCK_SECONDS },
    );
  }
}

export async function clearFailures(username: string) {
  await redis().del(failKey('u', username));
}

// ---------------------------------------------------------------------------
// "I saved it" confirmation: re-enter two of the six words.
// ---------------------------------------------------------------------------

const CONFIRM_TTL = 60 * 60;

export async function startConfirmation(userId: string, words: string[]): Promise<number[]> {
  const first = randomInt(PHRASE_WORDS);
  let second = randomInt(PHRASE_WORDS - 1);
  if (second >= first) second++;
  const indices = [first, second].sort((a, b) => a - b);
  const macs = indices.map((i) => hmac('recovery-confirm', `${userId}:${i}:${words[i]}`));
  await redis().set(`rc:${userId}`, { indices, macs }, { ex: CONFIRM_TTL });
  return indices;
}

export async function pendingConfirmation(userId: string): Promise<number[] | null> {
  const rec = await redis().get<{ indices: number[] }>(`rc:${userId}`);
  return rec?.indices ?? null;
}

export async function checkConfirmation(
  userId: string,
  answers: { index: number; word: string }[],
): Promise<'ok' | 'wrong' | 'expired'> {
  const rec = await redis().get<{ indices: number[]; macs: string[] }>(`rc:${userId}`);
  if (!rec) return 'expired';
  const ok = rec.indices.every((index, k) => {
    const answer = answers.find((a) => a.index === index);
    const word = answer ? normalizeWord(answer.word) : '';
    return safeEqual(hmac('recovery-confirm', `${userId}:${index}:${word}`), rec.macs[k]!);
  });
  if (ok) await redis().del(`rc:${userId}`);
  return ok ? 'ok' : 'wrong';
}

function normalizeWord(w: string): string {
  const x = w.normalize('NFKC').trim().toLowerCase();
  return WORDS.has(x) ? x : (BY_PREFIX.get(x.slice(0, 4)) ?? x);
}
