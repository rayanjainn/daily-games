import { SELF } from 'cloudflare:test';
import { describe, expect, inject, it } from 'vitest';
import { signInternalRequest } from '@everydaily/shared/realtime';
import type { PushOutcome } from '../src/push';
import { deliverToUser, type SubscriptionStore } from '../src/reminders';
import { createVapidKeys } from './webpush-decrypt';

function fakeStore(ids: string[], failures = 0) {
  const log: string[] = [];
  const store: SubscriptionStore = {
    forUser: async () =>
      ids.map((id) => ({ id, endpoint: `https://push.test/${id}`, p256dh: 'p', auth: 'a' })),
    sent: async (id) => void log.push(`sent:${id}`),
    failed: async (id) => {
      log.push(`failed:${id}`);
      return ++failures;
    },
    remove: async (id) => void log.push(`remove:${id}`),
  };
  return { store, log };
}
const note = {
  title: 'Wordle is waiting',
  body: 'Tap to play.',
  url: '/games/wordle',
  tag: 'game-wordle',
};
const sender = (outcomes: Record<string, PushOutcome>) =>
  (async (sub: { endpoint: string }) => outcomes[sub.endpoint.split('/').pop()!]!) as never;

describe('deliverToUser', () => {
  it('sends to every device and removes expired ones', async () => {
    const vapid = await createVapidKeys('mailto:test@everydaily.test');
    const { store, log } = fakeStore(['phone', 'laptop']);
    const r = await deliverToUser(
      store,
      vapid,
      'u1',
      note,
      sender({
        phone: { kind: 'sent', status: 201 },
        laptop: { kind: 'gone', status: 410 },
      }),
    );
    expect(r).toEqual({ sent: 1, removed: 1, retryAfter: null });
    expect(log).toEqual(['sent:phone', 'remove:laptop']);
  });

  it('asks for a retry on temporary failures and drops devices that keep failing', async () => {
    const vapid = await createVapidKeys('mailto:test@everydaily.test');
    const { store, log } = fakeStore(['a', 'b'], 4);
    const r = await deliverToUser(
      store,
      vapid,
      'u1',
      note,
      sender({
        a: { kind: 'retry', status: 429, retryAfter: 120 },
        b: { kind: 'failed', status: 400, detail: 'bad' },
      }),
    );
    expect(r).toEqual({ sent: 0, removed: 1, retryAfter: 120 });
    expect(log).toEqual(['failed:b', 'remove:b']);
  });
});

describe('POST /internal/push-test', () => {
  const call = async (payload: unknown, secret = inject('broadcastSecret')) => {
    const body = JSON.stringify(payload);
    const res = await SELF.fetch('https://worker.test/internal/push-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await signInternalRequest(secret, body)) },
      body,
    });
    return { status: res.status, text: await res.text() };
  };

  it('rejects unsigned and malformed requests', async () => {
    expect((await call({ userId: crypto.randomUUID() }, 'wrong-secret-0000')).status).toBe(401);
    expect((await call({ userId: 'not-a-uuid' })).status).toBe(400);
  });
});
