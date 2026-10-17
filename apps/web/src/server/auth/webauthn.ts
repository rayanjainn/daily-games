import 'server-only';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { env } from '../env';
import { randomToken } from '../crypto';
import { redis } from '../redis';
import { COOKIE, secureCookies } from '../request';
import { HttpError } from '../session';

const CHALLENGE_TTL = 180;

type Purpose = 'signup' | 'login' | 'add-passkey';

export interface StoredChallenge {
  purpose: Purpose;
  challenge: string;
  userId?: string;
  username?: string;
}

const uuidBytes = (uuid: string) => Uint8Array.from(Buffer.from(uuid.replace(/-/g, ''), 'hex'));

async function storeChallenge(rec: StoredChallenge) {
  const id = randomToken(16);
  await redis().set(`wa:${id}`, rec, { ex: CHALLENGE_TTL });
  (await cookies()).set(COOKIE.challenge, id, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'strict',
    // `__Host-` cookies must use Path=/ or browsers silently drop them.
    path: '/',
    maxAge: CHALLENGE_TTL,
  });
}

/** Single use: the challenge is deleted as it is read. */
export async function takeChallenge(purpose: Purpose): Promise<StoredChallenge> {
  const jar = await cookies();
  const id = jar.get(COOKIE.challenge)?.value;
  jar.delete(COOKIE.challenge);
  const rec =
    id && /^[A-Za-z0-9_-]{16,40}$/.test(id)
      ? await redis().getdel<StoredChallenge>(`wa:${id}`)
      : null;
  if (!rec || rec.purpose !== purpose) {
    throw new HttpError(
      400,
      'challenge_expired',
      'That took too long or was already used. Please try again.',
    );
  }
  return rec;
}

export async function registrationOptions(opts: {
  purpose: 'signup' | 'add-passkey';
  userId: string;
  username: string;
  exclude?: { id: string; transports: string[] }[];
}) {
  const { WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME } = env('webauthn');
  const options = await generateRegistrationOptions({
    rpName: WEBAUTHN_RP_NAME,
    rpID: WEBAUTHN_RP_ID,
    userID: uuidBytes(opts.userId),
    userName: opts.username,
    userDisplayName: opts.username,
    attestationType: 'none',
    timeout: 120_000,
    // Discoverable credentials with user verification. No attachment restriction, so phones,
    // laptops and security keys all work; the OS picks biometrics or the device PIN.
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: [-8, -7, -257],
    excludeCredentials: (opts.exclude ?? []).map((c) => ({
      id: c.id,
      transports: c.transports as AuthenticatorTransport[],
    })),
  });
  await storeChallenge({
    purpose: opts.purpose,
    challenge: options.challenge,
    userId: opts.userId,
    username: opts.username,
  });
  return options;
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
) {
  const { WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN } = env('webauthn');
  try {
    const res = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      requireUserVerification: true,
    });
    if (!res.verified) throw new Error('not verified');
    return res.registrationInfo;
  } catch (err) {
    throw new HttpError(
      400,
      'passkey_rejected',
      'We could not verify that passkey. Please try again.',
      { detail: String(err).slice(0, 200) },
    );
  }
}

export async function authenticationOptions() {
  const { WEBAUTHN_RP_ID } = env('webauthn');
  const options = await generateAuthenticationOptions({
    rpID: WEBAUTHN_RP_ID,
    userVerification: 'required',
    allowCredentials: [],
    timeout: 120_000,
  });
  await storeChallenge({ purpose: 'login', challenge: options.challenge });
  return options;
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: { id: string; publicKey: Uint8Array; counter: number; transports: string[] },
) {
  const { WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN } = env('webauthn');
  try {
    const res = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: WEBAUTHN_RP_ID,
      requireUserVerification: true,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransport[],
      },
    });
    if (!res.verified) throw new Error('not verified');
    return res.authenticationInfo;
  } catch (err) {
    throw new HttpError(400, 'passkey_rejected', 'That passkey could not be verified.', {
      detail: String(err).slice(0, 200),
    });
  }
}

/** A friendly default name for a new passkey, from the browser's user agent. */
export function defaultPasskeyName(ua: string | null, transports: string[]): string {
  if (transports.includes('usb') || transports.includes('nfc')) return 'Security key';
  const s = ua ?? '';
  if (/iPhone/.test(s)) return 'iPhone';
  if (/iPad/.test(s)) return 'iPad';
  if (/Android/.test(s)) return 'Android phone';
  if (/Macintosh|Mac OS X/.test(s)) return 'Mac';
  if (/Windows/.test(s)) return 'Windows PC';
  if (/CrOS/.test(s)) return 'Chromebook';
  if (/Linux/.test(s)) return 'Linux computer';
  return 'Passkey';
}
