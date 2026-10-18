import 'server-only';
import { NextResponse } from 'next/server';
import type { z, ZodType } from 'zod';
import { and, count, eq, isNull, captureTokens, users, type User } from '@everydaily/shared/db';
import { db } from './db';
import { randomToken, sha256 } from './crypto';
import { enforceLimit, errorResponse, handleError, HttpError } from './http';
import { clientIp } from './request';

export const TOKEN_PREFIX = 'edx_';
export const MAX_CAPTURE_TOKENS = 10;
const MAX_BODY = 16 * 1024;

/** Makes a token. The raw value is returned once and only its hash is kept. */
export async function createCaptureToken(userId: string, label: string) {
  const [counted] = await db()
    .select({ n: count() })
    .from(captureTokens)
    .where(and(eq(captureTokens.userId, userId), isNull(captureTokens.revokedAt)));
  if ((counted?.n ?? 0) >= MAX_CAPTURE_TOKENS)
    throw new HttpError(
      409,
      'too_many_tokens',
      `You can have up to ${MAX_CAPTURE_TOKENS} extension tokens. Remove one you no longer use.`,
    );
  const token = `${TOKEN_PREFIX}${randomToken(32)}`;
  const [row] = await db()
    .insert(captureTokens)
    .values({ userId, label, tokenHash: sha256(token) })
    .returning({ id: captureTokens.id, createdAt: captureTokens.createdAt });
  return { id: row!.id, createdAt: row!.createdAt, token };
}

/** Finds the user behind a `Bearer edx_…` header. Wrong tokens are rate limited by address. */
export async function userForCaptureToken(req: Request): Promise<{ user: User; tokenId: string }> {
  const header = req.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  const unauthorized = () =>
    new HttpError(401, 'bad_token', 'This extension token is missing, wrong or was removed.');
  if (!token || !token.startsWith(TOKEN_PREFIX) || token.length > 128) {
    await enforceLimit('capture-bad-token', await clientIp());
    throw unauthorized();
  }
  const rows = await db()
    .select({ user: users, tokenId: captureTokens.id })
    .from(captureTokens)
    .innerJoin(users, eq(users.id, captureTokens.userId))
    .where(and(eq(captureTokens.tokenHash, sha256(token)), isNull(captureTokens.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.deletedAt) {
    await enforceLimit('capture-bad-token', await clientIp());
    throw unauthorized();
  }
  await db()
    .update(captureTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(captureTokens.id, row.tokenId));
  return row;
}

/**
 * A route that takes the extension's bearer token instead of a cookie. Cookies are never read, so
 * a web page can't use someone's signed-in browser to reach it (no CSRF surface), and the token
 * can do nothing else.
 */
export function bearer<S extends ZodType>(
  schema: S,
  fn: (input: z.infer<S>, who: { user: User; tokenId: string }) => Promise<unknown>,
) {
  return async (req: Request) => {
    try {
      const who = await userForCaptureToken(req);
      const raw = await req.text();
      if (raw.length > MAX_BODY)
        throw new HttpError(413, 'too_large', 'Request body is too large.');
      let json: unknown = {};
      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch {
          throw new HttpError(400, 'bad_json', 'Request body must be JSON.');
        }
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success)
        return errorResponse(400, 'invalid_input', 'Some fields are invalid.', {
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      const out = await fn(parsed.data, who);
      return NextResponse.json(out ?? { ok: true }, { headers: { 'cache-control': 'no-store' } });
    } catch (err) {
      return handleError(err);
    }
  };
}
