import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signInternalRequest,
  verifyInternalRequest,
} from './hmac';

const SECRET = 'test-secret-value';

describe('internal request signing', () => {
  it('verifies a fresh signature', async () => {
    const body = '{"room":"group:a"}';
    const h = await signInternalRequest(SECRET, body);
    expect(
      await verifyInternalRequest(SECRET, body, h[SIGNATURE_HEADER], h[TIMESTAMP_HEADER]),
    ).toBe(true);
  });

  it('rejects wrong secret, altered body, stale timestamp and garbage', async () => {
    const body = '{"room":"group:a"}';
    const now = new Date('2026-10-17T12:00:00Z');
    const h = await signInternalRequest(SECRET, body, now);
    const sig = h[SIGNATURE_HEADER];
    const ts = h[TIMESTAMP_HEADER];
    expect(await verifyInternalRequest('other', body, sig, ts, now)).toBe(false);
    expect(await verifyInternalRequest(SECRET, body + ' ', sig, ts, now)).toBe(false);
    expect(
      await verifyInternalRequest(SECRET, body, sig, ts, new Date(now.getTime() + 61_000)),
    ).toBe(false);
    expect(await verifyInternalRequest(SECRET, body, null, ts, now)).toBe(false);
    expect(await verifyInternalRequest(SECRET, body, 'zz', ts, now)).toBe(false);
  });
});
