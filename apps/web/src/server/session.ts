import 'server-only';
import { and, eq, gt, isNull } from '@everydaily/shared/db';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { sessions, users, type User } from '@everydaily/shared/db';
import { db } from './db';
import { hashIp, randomToken, sha256 } from './crypto';
import { COOKIE, clientIp, secureCookies, userAgent } from './request';

const SESSION_DAYS = 30;
/** Sliding expiry is refreshed at most this often, to avoid a write per request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type SessionMethod = 'passkey' | 'recovery' | 'pairing' | 'email' | 'signup';

export interface CurrentSession {
  sessionId: string;
  user: User;
}

/**
 * Creates a session and sets the cookie. Any session cookie already present is revoked first,
 * so a login always rotates the token (no fixation).
 */
export async function startSession(userId: string, method: SessionMethod): Promise<void> {
  const jar = await cookies();
  const previous = jar.get(COOKIE.session)?.value;
  if (previous) await revokeByToken(previous);

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db()
    .insert(sessions)
    .values({
      tokenHash: sha256(token),
      userId,
      expiresAt,
      method,
      userAgent: await userAgent(),
      ipHash: hashIp(await clientIp()),
    });
  jar.set(COOKIE.session, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function revokeByToken(token: string) {
  await db()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, sha256(token)));
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE.session)?.value;
  if (token) await revokeByToken(token);
  jar.delete(COOKIE.session);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const token = (await cookies()).get(COOKIE.session)?.value;
  if (!token || token.length > 100) return null;
  const now = new Date();
  const rows = await db()
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (now.getTime() - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db()
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000) })
      .where(eq(sessions.id, row.session.id));
  }
  return { sessionId: row.session.id, user: row.user };
});

export async function requireSession(): Promise<CurrentSession> {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'unauthorized', 'Sign in to continue.');
  return s;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
