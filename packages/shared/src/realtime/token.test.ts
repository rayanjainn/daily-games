import { describe, expect, it } from 'vitest';
import { encodeBase64Url } from '../util/base64url';
import {
  generateRealtimeKeyPair,
  importSigningKey,
  importVerifyKey,
  signRealtimeToken,
  verifyRealtimeToken,
} from './token';

const input = { sub: 'u1', name: 'brave-otter-12', room: 'group:abc', perms: ['read' as const] };

async function keys() {
  const pair = await generateRealtimeKeyPair();
  return {
    sign: await importSigningKey(pair.privateKey),
    verify: await importVerifyKey(pair.publicKey),
  };
}

describe('realtime tokens', () => {
  it('round-trips claims', async () => {
    const k = await keys();
    const now = new Date('2026-10-17T12:00:00Z');
    const { token, claims } = await signRealtimeToken(k.sign, input, now);
    const res = await verifyRealtimeToken(k.verify, token, now);
    expect(res).toEqual({ ok: true, claims });
    expect(claims.exp - claims.iat).toBe(60);
    expect(claims.jti.length).toBeGreaterThanOrEqual(16);
  });

  it('rejects a token signed by a different key', async () => {
    const a = await keys();
    const b = await keys();
    const { token } = await signRealtimeToken(a.sign, input);
    expect(await verifyRealtimeToken(b.verify, token)).toEqual({
      ok: false,
      error: 'bad_signature',
    });
  });

  it('rejects tampered claims', async () => {
    const k = await keys();
    const { token } = await signRealtimeToken(k.sign, input);
    const [, sig] = token.split('.');
    const forged = encodeBase64Url(
      new TextEncoder().encode(JSON.stringify({ ...input, room: 'group:other' })),
    );
    expect(await verifyRealtimeToken(k.verify, `${forged}.${sig}`)).toEqual({
      ok: false,
      error: 'bad_signature',
    });
  });

  it('rejects expired and future tokens, allowing small skew', async () => {
    const k = await keys();
    const t0 = new Date('2026-10-17T12:00:00Z');
    const { token } = await signRealtimeToken(k.sign, input, t0);
    const at = (s: number) => new Date(t0.getTime() + s * 1000);
    expect((await verifyRealtimeToken(k.verify, token, at(64))).ok).toBe(true);
    expect(await verifyRealtimeToken(k.verify, token, at(70))).toEqual({
      ok: false,
      error: 'expired',
    });
    expect(await verifyRealtimeToken(k.verify, token, at(-10))).toEqual({
      ok: false,
      error: 'not_yet_valid',
    });
  });

  it.each(['', 'abc', 'a.b.c', '!!!.###', 'x'.repeat(3000)])('rejects malformed %#', async (t) => {
    const k = await keys();
    const res = await verifyRealtimeToken(k.verify, t);
    expect(res.ok).toBe(false);
  });

  it('refuses to sign an invalid room', async () => {
    const k = await keys();
    await expect(signRealtimeToken(k.sign, { ...input, room: 'admin:all' })).rejects.toThrow();
  });
});
