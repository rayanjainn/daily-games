import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from '@block65/webcrypto-web-push';
import type { Env } from './env';

export type { PushSubscription };

export interface PushNotification {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export type PushOutcome =
  | { kind: 'sent'; status: number }
  /** Subscription no longer exists; caller must delete it. */
  | { kind: 'gone'; status: number }
  /** Temporary failure; caller should retry with backoff. */
  | { kind: 'retry'; status: number; retryAfter?: number }
  /** Permanent failure for this message (bad payload, auth). Do not retry. */
  | { kind: 'failed'; status: number; detail: string };

const TOPIC_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function vapidFromEnv(env: Env): VapidKeys {
  return {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

export interface PushOptions {
  ttl?: number;
  urgency?: 'low' | 'normal' | 'high';
}

/** Encrypts the notification for one subscription and returns the request to send. */
export function buildPushRequest(
  subscription: PushSubscription,
  notification: PushNotification,
  vapid: VapidKeys,
  options: PushOptions = {},
) {
  return buildPushPayload(
    {
      data: JSON.stringify(notification),
      options: {
        ttl: options.ttl ?? 60 * 60,
        urgency: options.urgency ?? 'normal',
        // RFC 8030 §5.4: a topic replaces any undelivered message with the same topic.
        ...(notification.tag && TOPIC_RE.test(notification.tag) ? { topic: notification.tag } : {}),
      },
    },
    subscription,
    vapid,
  );
}

export async function sendPush(
  subscription: PushSubscription,
  notification: PushNotification,
  vapid: VapidKeys,
  options: PushOptions = {},
): Promise<PushOutcome> {
  const request = await buildPushRequest(subscription, notification, vapid, options);
  return classify(await fetch(subscription.endpoint, request));
}

export async function classify(res: Response): Promise<PushOutcome> {
  const status = res.status;
  if (status >= 200 && status < 300) return { kind: 'sent', status };
  if (status === 404 || status === 410) return { kind: 'gone', status };
  if (status === 429 || status >= 500) {
    const ra = Number(res.headers.get('retry-after'));
    return { kind: 'retry', status, ...(Number.isFinite(ra) && ra > 0 ? { retryAfter: ra } : {}) };
  }
  const detail = (await res.text().catch(() => '')).slice(0, 500);
  return { kind: 'failed', status, detail };
}
