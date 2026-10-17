import { createDb, eq, pushSubscriptions, sql, type Database } from '@everydaily/shared/db';
import type { Notification } from '@everydaily/shared/reminders/plan';
import { planDueReminders, pruneDeliveries } from '@everydaily/shared/reminders/run';
import type { Env } from './env';
import { sendPush, vapidFromEnv, type PushOutcome } from './push';
import type { VapidKeys } from '@block65/webcrypto-web-push';

/** Keep in sync with [triggers] in wrangler.toml. */
export const REMINDER_CRON = '*/15 * * * *';

/** A subscription that keeps failing permanently is dropped after this many attempts. */
const MAX_FAILURES = 5;

export interface ReminderMessage {
  userId: string;
  notification: Notification;
}

export interface SubscriptionStore {
  forUser(
    userId: string,
  ): Promise<{ id: string; endpoint: string; p256dh: string; auth: string }[]>;
  sent(id: string): Promise<void>;
  /** Records a permanent failure and returns the new failure count. */
  failed(id: string): Promise<number>;
  remove(id: string): Promise<void>;
}

export function dbSubscriptionStore(db: Database): SubscriptionStore {
  return {
    forUser: (userId) =>
      db
        .select({
          id: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
        })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId)),
    async sent(id) {
      await db
        .update(pushSubscriptions)
        .set({ lastSuccessAt: new Date(), failures: 0 })
        .where(eq(pushSubscriptions.id, id));
    },
    async failed(id) {
      const [row] = await db
        .update(pushSubscriptions)
        .set({ failures: sql`${pushSubscriptions.failures} + 1` })
        .where(eq(pushSubscriptions.id, id))
        .returning({ failures: pushSubscriptions.failures });
      return row?.failures ?? MAX_FAILURES;
    },
    async remove(id) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
    },
  };
}

export interface DeliveryReport {
  sent: number;
  removed: number;
  /** Seconds to wait before retrying, when any device asked us to try again later. */
  retryAfter: number | null;
}

/**
 * Sends one notification to every device of a player. Expired subscriptions are deleted, and
 * ones that keep failing permanently are dropped. `retryAfter` is set when a device asked us to
 * try later; the queue consumer only retries when no device got the reminder at all.
 */
export async function deliverToUser(
  store: SubscriptionStore,
  vapid: VapidKeys,
  userId: string,
  notification: Notification,
  send: typeof sendPush = sendPush,
): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, removed: 0, retryAfter: null };
  for (const s of await store.forUser(userId)) {
    let outcome: PushOutcome;
    try {
      outcome = await send(
        { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
        notification,
        vapid,
        { ttl: 6 * 3600, urgency: 'normal' },
      );
    } catch {
      outcome = { kind: 'retry', status: 0 };
    }
    if (outcome.kind === 'sent') {
      report.sent++;
      await store.sent(s.id);
    } else if (outcome.kind === 'gone') {
      report.removed++;
      await store.remove(s.id);
    } else if (outcome.kind === 'retry') {
      report.retryAfter = Math.max(report.retryAfter ?? 0, outcome.retryAfter ?? 60);
    } else if ((await store.failed(s.id)) >= MAX_FAILURES) {
      report.removed++;
      await store.remove(s.id);
    }
  }
  return report;
}

/** Cron: plans the reminders due in this slot and queues them for delivery. */
export async function runReminderCron(env: Env, now = new Date()) {
  const { db, client } = createDb(env.HYPERDRIVE.connectionString, { max: 2 });
  try {
    const planned = await planDueReminders(db, now);
    for (let i = 0; i < planned.length; i += 100) {
      await env.REMINDERS.sendBatch(
        planned.slice(i, i + 100).map((p) => ({
          body: { userId: p.userId, notification: p.notification } satisfies ReminderMessage,
        })),
      );
    }
    if (now.getUTCMinutes() < 15) await pruneDeliveries(db, now);
    return { queued: planned.length };
  } finally {
    await client.end();
  }
}

/** Queue consumer: delivers each reminder, retrying the ones that hit temporary failures. */
export async function handleReminderBatch(batch: MessageBatch<ReminderMessage>, env: Env) {
  const { db, client } = createDb(env.HYPERDRIVE.connectionString, { max: 2 });
  try {
    const store = dbSubscriptionStore(db);
    const vapid = vapidFromEnv(env);
    for (const msg of batch.messages) {
      const r = await deliverToUser(store, vapid, msg.body.userId, msg.body.notification);
      if (r.retryAfter !== null && r.sent === 0) msg.retry({ delaySeconds: r.retryAfter });
      else msg.ack();
    }
  } finally {
    await client.end();
  }
}
