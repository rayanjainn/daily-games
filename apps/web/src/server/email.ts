import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { and, emailTokens, eq, gt, isNull, users } from '@everydaily/shared/db';
import { sendEmail, type EmailMessage } from '@everydaily/shared/email/resend';
import { verifyEmail } from '@everydaily/shared/email/templates';
import { randomToken, sha256 } from './crypto';
import { db } from './db';
import { env } from './env';
import { HttpError } from './session';

const TOKEN_TTL_MS = 24 * 3600_000;

export const emailInputSchema = z
  .object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254) })
  .strict();

/**
 * The dev outbox (emails written as files) only works when the app itself runs on localhost, so
 * a stray EMAIL_DEV_OUTBOX on a real deployment can never swallow mail.
 */
function devOutbox(): string | null {
  const dir = env('email').EMAIL_DEV_OUTBOX;
  const host = new URL(env('core').APP_URL).hostname;
  return dir && (host === 'localhost' || host === '127.0.0.1') ? dir : null;
}

/** True when this server can send email (or write it to the local dev outbox). */
export function emailEnabled(): boolean {
  const e = env('email');
  return Boolean((e.RESEND_API_KEY && e.EMAIL_FROM) || devOutbox());
}

async function deliver(msg: EmailMessage) {
  const e = env('email');
  if (e.RESEND_API_KEY && e.EMAIL_FROM) {
    const out = await sendEmail({ apiKey: e.RESEND_API_KEY, from: e.EMAIL_FROM }, msg);
    if (!out.ok)
      throw new HttpError(502, 'email_failed', "We couldn't send the email. Try again later.");
    return;
  }
  const outbox = devOutbox();
  if (outbox) {
    await mkdir(outbox, { recursive: true });
    await writeFile(join(outbox, `${msg.to}.json`), JSON.stringify(msg, null, 2));
    return;
  }
  throw new HttpError(503, 'email_unavailable', "Email isn't set up on this server.");
}

/**
 * Sets (or changes) the player's email and sends a confirmation link. The address counts only
 * once confirmed; until then it is shown as unverified and gets nothing else.
 */
export async function startEmailVerification(userId: string, email: string) {
  if (!emailEnabled())
    throw new HttpError(503, 'email_unavailable', "Email isn't set up on this server.");
  const taken = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (taken.length && taken[0]!.id !== userId)
    throw new HttpError(409, 'email_taken', 'That email is already used by another account.');

  const token = randomToken();
  await db().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ email, emailVerifiedAt: null, emailReminders: false })
      .where(eq(users.id, userId));
    // Only the newest link works.
    await tx
      .delete(emailTokens)
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, 'verify')));
    await tx.insert(emailTokens).values({
      userId,
      email,
      tokenHash: sha256(token),
      purpose: 'verify',
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });
  });
  const link = new URL(`/verify-email?token=${token}`, env('core').APP_URL).toString();
  await deliver(verifyEmail(email, link));
  return { email, verified: false };
}

export type VerifyOutcome = 'verified' | 'invalid' | 'expired' | 'changed';

/** Confirms an address from the emailed link. Single use; the link dies if the email changed. */
export async function confirmEmailToken(token: string): Promise<VerifyOutcome> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return 'invalid';
  return db().transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.tokenHash, sha256(token)), eq(emailTokens.purpose, 'verify')))
      .for('update');
    if (!t || t.usedAt) return 'invalid';
    if (t.expiresAt < new Date()) return 'expired';
    const updated = await tx
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(and(eq(users.id, t.userId), eq(users.email, t.email), isNull(users.deletedAt)))
      .returning({ id: users.id });
    await tx.update(emailTokens).set({ usedAt: new Date() }).where(eq(emailTokens.id, t.id));
    return updated.length ? 'verified' : 'changed';
  });
}

export async function removeEmail(userId: string) {
  await db().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ email: null, emailVerifiedAt: null, emailReminders: false })
      .where(eq(users.id, userId));
    await tx.delete(emailTokens).where(eq(emailTokens.userId, userId));
  });
}

/** Unused, unexpired verification link exists (to say "check your inbox"). */
export async function pendingVerification(userId: string) {
  const rows = await db()
    .select({ id: emailTokens.id })
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.purpose, 'verify'),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
