/**
 * Short-lived realtime tokens.
 * The web app signs with an Ed25519 private key; the worker verifies with the public key only,
 * so a compromised worker cannot mint tokens. Format: base64url(json claims) "." base64url(sig).
 * Uses only Web Crypto, so it runs in Node, Next.js and workerd.
 */
import { z } from 'zod';
import { decodeBase64Url, encodeBase64Url } from '../util/base64url';
import { parseRoom } from './rooms';

export const REALTIME_PERMS = ['read', 'typing', 'presence'] as const;

export const realtimeClaimsSchema = z.object({
  v: z.literal(1),
  sub: z.string().min(1).max(64),
  name: z.string().min(1).max(32),
  room: z.string().refine((r) => parseRoom(r) !== null, 'invalid room'),
  perms: z.array(z.enum(REALTIME_PERMS)).max(REALTIME_PERMS.length),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.string().min(16).max(64),
});
export type RealtimeClaims = z.infer<typeof realtimeClaimsSchema>;

export const REALTIME_TOKEN_TTL_SECONDS = 60;
/** Accepted clock skew between web app and worker. */
const SKEW_SECONDS = 5;

const ALG = { name: 'Ed25519' } as const;
const enc = new TextEncoder();

export async function importSigningKey(pkcs8Base64Url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', decodeBase64Url(pkcs8Base64Url), ALG, false, ['sign']);
}

export async function importVerifyKey(rawBase64Url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', decodeBase64Url(rawBase64Url), ALG, false, ['verify']);
}

export async function generateRealtimeKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const pair = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pkcs8 = (await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer;
  const raw = (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer;
  return { privateKey: encodeBase64Url(pkcs8), publicKey: encodeBase64Url(raw) };
}

export async function signRealtimeToken(
  key: CryptoKey,
  input: Pick<RealtimeClaims, 'sub' | 'name' | 'room' | 'perms'>,
  now: Date = new Date(),
  ttlSeconds: number = REALTIME_TOKEN_TTL_SECONDS,
): Promise<{ token: string; claims: RealtimeClaims }> {
  const iat = Math.floor(now.getTime() / 1000);
  const claims = realtimeClaimsSchema.parse({
    v: 1,
    ...input,
    iat,
    exp: iat + ttlSeconds,
    jti: encodeBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  });
  const body = encodeBase64Url(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign(ALG, key, enc.encode(body));
  return { token: `${body}.${encodeBase64Url(sig)}`, claims };
}

export type VerifyError = 'malformed' | 'bad_signature' | 'expired' | 'not_yet_valid';

export async function verifyRealtimeToken(
  key: CryptoKey,
  token: string,
  now: Date = new Date(),
): Promise<{ ok: true; claims: RealtimeClaims } | { ok: false; error: VerifyError }> {
  if (token.length > 2048) return { ok: false, error: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'malformed' };
  const [body, sig] = parts as [string, string];

  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = decodeBase64Url(sig);
  } catch {
    return { ok: false, error: 'malformed' };
  }
  const valid = await crypto.subtle.verify(ALG, key, sigBytes, enc.encode(body));
  if (!valid) return { ok: false, error: 'bad_signature' };

  let parsed: ReturnType<typeof realtimeClaimsSchema.safeParse>;
  try {
    parsed = realtimeClaimsSchema.safeParse(
      JSON.parse(new TextDecoder().decode(decodeBase64Url(body))),
    );
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (!parsed.success) return { ok: false, error: 'malformed' };

  const t = Math.floor(now.getTime() / 1000);
  if (parsed.data.iat > t + SKEW_SECONDS) return { ok: false, error: 'not_yet_valid' };
  if (parsed.data.exp < t - SKEW_SECONDS) return { ok: false, error: 'expired' };
  return { ok: true, claims: parsed.data };
}
