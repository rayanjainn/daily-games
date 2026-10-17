import type { Metadata } from 'next';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  passkeyCredentials,
  recoveryPhraseHashes,
  sessions,
} from '@everydaily/shared/db';
import { db } from '@/server/db';
import { emailEnabled, pendingVerification } from '@/server/email';
import { getReminderSettings } from '@/server/reminders';
import { requireSession } from '@/server/session';
import { describeDevice } from '@/server/auth/pairing';
import { SettingsView } from './settings-view';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { user, sessionId } = await requireSession();
  const [passkeys, sessionRows, phrase, reminders, pending] = await Promise.all([
    db()
      .select({
        id: passkeyCredentials.id,
        nickname: passkeyCredentials.nickname,
        deviceType: passkeyCredentials.deviceType,
        backedUp: passkeyCredentials.backedUp,
        transports: passkeyCredentials.transports,
        createdAt: passkeyCredentials.createdAt,
        lastUsedAt: passkeyCredentials.lastUsedAt,
      })
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, user.id))
      .orderBy(asc(passkeyCredentials.createdAt)),
    db()
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        method: sessions.method,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, user.id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.lastSeenAt)),
    db()
      .select({ createdAt: recoveryPhraseHashes.createdAt })
      .from(recoveryPhraseHashes)
      .where(eq(recoveryPhraseHashes.userId, user.id)),
    getReminderSettings(user),
    pendingVerification(user.id),
  ]);

  return (
    <SettingsView
      user={{
        username: user.username,
        displayName: user.displayName,
        timezone: user.timezone,
        email: user.emailVerifiedAt ? user.email : null,
      }}
      passkeys={passkeys.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
      }))}
      sessions={sessionRows.map((s) => ({
        id: s.id,
        method: s.method,
        device: describeDevice(s.userAgent),
        lastSeenAt: s.lastSeenAt.toISOString(),
        current: s.id === sessionId,
      }))}
      reminders={reminders}
      email={{
        email: user.email,
        verified: Boolean(user.emailVerifiedAt),
        pending,
        enabled: emailEnabled(),
      }}
      recovery={{
        exists: phrase.length > 0,
        confirmed: Boolean(user.recoveryConfirmedAt),
        createdAt: phrase[0]?.createdAt.toISOString() ?? null,
      }}
    />
  );
}
