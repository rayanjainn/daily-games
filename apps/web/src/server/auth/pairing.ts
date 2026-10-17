import 'server-only';
import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { and, devicePairings, eq } from '@everydaily/shared/db';
import { db } from '../db';
import { randomToken, sha256 } from '../crypto';
import { env } from '../env';
import { HttpError } from '../session';

/**
 * Device pairing: a new device shows a QR code; a signed-in device opens it, picks the matching
 * number and approves. The new device then consumes the approval exactly once.
 *
 *   pending ──approve(right number)──▶ approved ──consume──▶ consumed
 *      │ └──approve(wrong number) / deny──▶ denied
 *      └──2 minutes──▶ expired (computed from expires_at)
 */
export const PAIR_TTL_SECONDS = 120;

export type PairingStatus = 'pending' | 'approved' | 'denied' | 'consumed' | 'expired';

export async function startPairing(userAgent: string | null) {
  const code = randomToken(16);
  const pollSecret = randomToken(24);
  const number = randomInt(10, 100);
  const expiresAt = new Date(Date.now() + PAIR_TTL_SECONDS * 1000);
  await db()
    .insert(devicePairings)
    .values({
      codeHash: sha256(code),
      pollSecretHash: sha256(pollSecret),
      numberMatch: number,
      initiatorUserAgent: userAgent,
      expiresAt,
    });
  const url = new URL(`/pair/${code}`, env('core').APP_URL).toString();
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#1D1A3A', light: '#FFFFFF' },
  });
  return {
    code,
    pollSecret,
    number,
    url,
    expiresAt,
    qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  };
}

const effective = (row: { status: string; expiresAt: Date }): PairingStatus =>
  row.status === 'pending' && row.expiresAt.getTime() <= Date.now()
    ? 'expired'
    : (row.status as PairingStatus);

async function byCode(code: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(code)) return null;
  const rows = await db()
    .select()
    .from(devicePairings)
    .where(eq(devicePairings.codeHash, sha256(code)))
    .limit(1);
  return rows[0] ?? null;
}

async function byPollSecret(secret: string | undefined) {
  if (!secret || !/^[A-Za-z0-9_-]{20,64}$/.test(secret)) return null;
  const rows = await db()
    .select()
    .from(devicePairings)
    .where(eq(devicePairings.pollSecretHash, sha256(secret)))
    .limit(1);
  return rows[0] ?? null;
}

/** What the signed-in device sees when it opens the link. */
export async function describePairing(code: string) {
  const row = await byCode(code);
  if (!row) return null;
  const status = effective(row);
  // Three choices: the right number plus two distinct decoys, in random order.
  const choices = new Set([row.numberMatch]);
  while (choices.size < 3) choices.add(randomInt(10, 100));
  return {
    status,
    choices: [...choices].sort(() => randomInt(3) - 1),
    device: describeDevice(row.initiatorUserAgent),
    expiresAt: row.expiresAt,
  };
}

export async function approvePairing(
  code: string,
  number: number,
  userId: string,
): Promise<'approved' | 'wrong_number'> {
  const row = await byCode(code);
  if (!row || effective(row) !== 'pending')
    throw new HttpError(
      410,
      'pair_expired',
      'This sign-in request has expired. Start again on the other device.',
    );
  if (number !== row.numberMatch) {
    // One guess only: a wrong pick cancels the request.
    await db()
      .update(devicePairings)
      .set({ status: 'denied' })
      .where(and(eq(devicePairings.id, row.id), eq(devicePairings.status, 'pending')));
    return 'wrong_number';
  }
  const updated = await db()
    .update(devicePairings)
    .set({ status: 'approved', approvedByUserId: userId, approvedAt: new Date() })
    .where(and(eq(devicePairings.id, row.id), eq(devicePairings.status, 'pending')))
    .returning({ id: devicePairings.id });
  if (!updated.length)
    throw new HttpError(410, 'pair_expired', 'This sign-in request is no longer waiting.');
  return 'approved';
}

export async function denyPairing(code: string) {
  const row = await byCode(code);
  if (row && effective(row) === 'pending') {
    await db()
      .update(devicePairings)
      .set({ status: 'denied' })
      .where(and(eq(devicePairings.id, row.id), eq(devicePairings.status, 'pending')));
  }
}

export async function pairingStatus(pollSecret: string | undefined): Promise<PairingStatus | null> {
  const row = await byPollSecret(pollSecret);
  return row ? effective(row) : null;
}

/** Single use: flips approved → consumed atomically and returns who approved it. */
export async function consumePairing(pollSecret: string | undefined): Promise<string> {
  const row = await byPollSecret(pollSecret);
  if (!row || effective(row) !== 'approved' || !row.approvedByUserId) {
    throw new HttpError(
      400,
      'pair_not_approved',
      'This sign-in has not been approved, or was already used.',
    );
  }
  if (row.expiresAt.getTime() + PAIR_TTL_SECONDS * 1000 < Date.now()) {
    throw new HttpError(410, 'pair_expired', 'This approval expired. Start again.');
  }
  const updated = await db()
    .update(devicePairings)
    .set({ status: 'consumed' })
    .where(and(eq(devicePairings.id, row.id), eq(devicePairings.status, 'approved')))
    .returning({ userId: devicePairings.approvedByUserId });
  if (!updated.length || !updated[0]!.userId)
    throw new HttpError(400, 'pair_not_approved', 'This sign-in was already used.');
  return updated[0]!.userId;
}

export function describeDevice(ua: string | null): string {
  const s = ua ?? '';
  const browser = /Edg\//.test(s)
    ? 'Edge'
    : /Firefox\//.test(s)
      ? 'Firefox'
      : /Chrome\//.test(s)
        ? 'Chrome'
        : /Safari\//.test(s)
          ? 'Safari'
          : 'a browser';
  const os = /iPhone|iPad/.test(s)
    ? 'iOS'
    : /Android/.test(s)
      ? 'Android'
      : /Mac OS X/.test(s)
        ? 'macOS'
        : /Windows/.test(s)
          ? 'Windows'
          : /CrOS/.test(s)
            ? 'ChromeOS'
            : /Linux/.test(s)
              ? 'Linux'
              : 'an unknown system';
  return `${browser} on ${os}`;
}
