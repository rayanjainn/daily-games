import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function hmac(purpose: string, value: string): string {
  return createHmac('sha256', env('core').AUTH_SECRET)
    .update(`${purpose}\u0000${value}`)
    .digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Short signed tokens: base64url(json).hmac. Used for the puzzle-gate pass, which only needs to
 * prove "this device solved a gate recently".
 */
export function signToken(
  purpose: string,
  payload: Record<string, unknown>,
  ttlSeconds: number,
): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString('base64url');
  return `${body}.${hmac(purpose, body)}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  purpose: string,
  token: string | undefined | null,
): T | null {
  if (!token || token.length > 1024) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqual(sig, hmac(purpose, body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    return data.exp >= Math.floor(Date.now() / 1000) ? data : null;
  } catch {
    return null;
  }
}

/** Salted IP hash: lets us rate-limit and audit without storing raw addresses. */
export const hashIp = (ip: string) => hmac('ip', ip).slice(0, 32);
