import 'server-only';
import { z } from 'zod';
import { signInternalRequest } from '@everydaily/shared/realtime';
import { asc, eq, follows, games, ne, and, pushSubscriptions, users } from '@everydaily/shared/db';
import { db } from './db';
import { env, serverEnv } from './env';
import { HttpError } from './session';

/** "HH:MM" on a 24-hour clock. */
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 07:30.');

export const subscriptionSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .max(1000)
      .refine((u) => u.startsWith('https://'), 'Push endpoints must be https.'),
    keys: z
      .object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) })
      .strict(),
    label: z.string().trim().max(60).optional(),
  })
  .strict();

export const reminderPrefsSchema = z
  .object({
    streakNudgeAt: clockTime.nullable().optional(),
    quietHours: z.object({ start: clockTime, end: clockTime }).strict().nullable().optional(),
    emailReminders: z.boolean().optional(),
  })
  .strict();

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export interface ReminderSettings {
  vapidKey: string | null;
  devices: number;
  streakNudgeAt: string | null;
  quietHours: { start: string; end: string } | null;
  games: { gameId: string; name: string; remindAt: string | null }[];
  /** null when the account has no verified email. */
  emailReminders: boolean | null;
}

export async function getReminderSettings(user: {
  id: string;
  streakNudgeAt: string | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  emailVerifiedAt: Date | null;
  emailReminders: boolean;
}): Promise<ReminderSettings> {
  const [devices, rows] = await Promise.all([
    db()
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id)),
    db()
      .select({ gameId: games.id, name: games.name, remindAt: follows.remindAt })
      .from(follows)
      .innerJoin(games, eq(games.id, follows.gameId))
      .where(and(eq(follows.userId, user.id), ne(games.status, 'archived')))
      .orderBy(asc(follows.position), asc(games.name)),
  ]);
  const start = hhmm(user.quietHoursStart);
  const end = hhmm(user.quietHoursEnd);
  return {
    vapidKey: env('push').NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    devices: devices.length,
    streakNudgeAt: hhmm(user.streakNudgeAt),
    quietHours: start && end ? { start, end } : null,
    games: rows.map((r) => ({ ...r, remindAt: hhmm(r.remindAt) })),
    emailReminders: user.emailVerifiedAt ? user.emailReminders : null,
  };
}

/** Stores a browser's subscription for this player; a re-subscribe on the same browser moves it. */
export async function saveSubscription(userId: string, s: z.infer<typeof subscriptionSchema>) {
  await db()
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: s.endpoint,
      p256dh: s.keys.p256dh,
      auth: s.keys.auth,
      label: s.label ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: s.keys.p256dh,
        auth: s.keys.auth,
        label: s.label ?? null,
        failures: 0,
      },
    });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await db()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function saveReminderPrefs(
  user: { id: string; emailVerifiedAt: Date | null },
  p: z.infer<typeof reminderPrefsSchema>,
) {
  const userId = user.id;
  const set: Partial<typeof users.$inferInsert> = {};
  if (p.emailReminders !== undefined) {
    if (p.emailReminders && !user.emailVerifiedAt)
      throw new HttpError(422, 'email_unverified', 'Confirm your email first.');
    set.emailReminders = p.emailReminders;
  }
  if (p.streakNudgeAt !== undefined) set.streakNudgeAt = p.streakNudgeAt;
  if (p.quietHours !== undefined) {
    set.quietHoursStart = p.quietHours?.start ?? null;
    set.quietHoursEnd = p.quietHours?.end ?? null;
  }
  if (Object.keys(set).length) await db().update(users).set(set).where(eq(users.id, userId));
}

/** Asks the worker (which holds the VAPID private key) to send a test notification. */
export async function sendTestPush(userId: string) {
  let config: ReturnType<typeof serverEnv>;
  try {
    config = serverEnv();
  } catch {
    throw new HttpError(503, 'push_unavailable', "Notifications aren't set up on this server.");
  }
  const { WORKER_INTERNAL_URL, INTERNAL_BROADCAST_SECRET } = config;
  const body = JSON.stringify({ userId });
  const res = await fetch(new URL('/internal/push-test', WORKER_INTERNAL_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(await signInternalRequest(INTERNAL_BROADCAST_SECRET, body)),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok)
    throw new HttpError(502, 'push_unavailable', "Couldn't reach the notification service.");
  return (await res.json()) as { sent: number; removed: number };
}
