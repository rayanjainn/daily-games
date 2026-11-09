import 'server-only';
import { hash, verify } from '@node-rs/argon2';
import { redis } from '../redis';
import { checkPasswordRules } from './password-rules';

export { checkPasswordRules, PASSWORD_MAX, PASSWORD_MIN } from './password-rules';

// argon2id, OWASP-recommended parameters (64 MiB, 3 passes).
const ARGON = { algorithm: 2, memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;

const normalize = (pw: string) => pw.normalize('NFKC');

export function hashPassword(password: string): Promise<string> {
  return hash(normalize(password), ARGON);
}

let dummyHash: Promise<string> | null = null;
/**
 * Checks a password. With no stored hash (unknown name, or an account without a password) it
 * still does the same work, so the answer takes as long either way.
 */
export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  dummyHash ??= hash('decoy-password-for-timing', ARGON);
  const ok = await verify(stored ?? (await dummyHash), normalize(password)).catch(() => false);
  return ok && stored !== null;
}

/** Throws nothing; returns the problem in words, or null when the password is fine. */
export function passwordProblem(password: string, username: string): string | null {
  return checkPasswordRules(normalize(password), username);
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

const failKey = (scope: 'u' | 'ip', id: string) => `login-fail:${scope}:${id}`;

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

export function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  if (seconds < 5400) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}
