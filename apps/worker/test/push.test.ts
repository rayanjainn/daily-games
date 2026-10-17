import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendPush } from '../src/push';
import {
  createBrowserSubscription,
  createVapidKeys,
  decryptAes128gcm,
  verifyVapid,
} from './webpush-decrypt';

const ENDPOINT = 'https://push.example.test/send/abc123';

function captureFetch(response: Response) {
  const calls: { url: string; init: RequestInit & { body: Uint8Array } }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = new Uint8Array(await new Response(init?.body).arrayBuffer());
    calls.push({ url: String(input), init: { ...init, body } });
    return response.clone();
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe('sendPush (runs inside workerd)', () => {
  it('produces an aes128gcm payload the browser can decrypt, signed with VAPID', async () => {
    const vapid = await createVapidKeys('mailto:test@everydaily.test');
    const ua = await createBrowserSubscription(ENDPOINT);
    const calls = captureFetch(new Response(null, { status: 201 }));

    const outcome = await sendPush(
      ua.subscription,
      { title: 'Wordle is waiting', body: 'Keep your 12-day streak going', tag: 'wordle' },
      vapid,
      { ttl: 3600, urgency: 'high' },
    );

    expect(outcome).toEqual({ kind: 'sent', status: 201 });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init.method?.toUpperCase()).toBe('POST');

    const headers = new Headers(init.headers);
    expect(headers.get('content-encoding')).toBe('aes128gcm');
    expect(headers.get('ttl')).toBe('3600');
    expect(headers.get('urgency')).toBe('high');
    expect(headers.get('topic')).toBe('wordle');

    const plaintext = await decryptAes128gcm(init.body, ua);
    expect(JSON.parse(plaintext)).toEqual({
      title: 'Wordle is waiting',
      body: 'Keep your 12-day streak going',
      tag: 'wordle',
    });

    const { header, claims } = await verifyVapid(headers.get('authorization')!, vapid.publicKey);
    expect(header.alg).toBe('ES256');
    expect(claims.aud).toBe('https://push.example.test');
    expect(claims.sub).toBe('mailto:test@everydaily.test');
    const now = Math.floor(Date.now() / 1000);
    expect(claims.exp).toBeGreaterThan(now);
    expect(claims.exp).toBeLessThanOrEqual(now + 24 * 3600); // RFC 8292 §2 cap
  });

  it('omits the Topic header when the tag is not a valid topic', async () => {
    const vapid = await createVapidKeys('mailto:test@everydaily.test');
    const ua = await createBrowserSubscription(ENDPOINT);
    const calls = captureFetch(new Response(null, { status: 201 }));
    await sendPush(ua.subscription, { title: 't', body: 'b', tag: 'reminder:wordle' }, vapid);
    expect(new Headers(calls[0]!.init.headers).has('topic')).toBe(false);
  });

  it.each([
    [404, 'gone'],
    [410, 'gone'],
    [429, 'retry'],
    [503, 'retry'],
    [400, 'failed'],
    [403, 'failed'],
  ] as const)('classifies HTTP %i as %s', async (status, kind) => {
    const vapid = await createVapidKeys('mailto:test@everydaily.test');
    const ua = await createBrowserSubscription(ENDPOINT);
    captureFetch(new Response('nope', { status, headers: { 'retry-after': '30' } }));
    const outcome = await sendPush(ua.subscription, { title: 't', body: 'b' }, vapid);
    expect(outcome.kind).toBe(kind);
    if (outcome.kind === 'retry') expect(outcome.retryAfter).toBe(30);
  });
});
