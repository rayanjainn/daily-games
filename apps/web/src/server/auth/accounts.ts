import 'server-only';
import { eq } from '@everydaily/shared/db';
import { passkeyCredentials, recoveryPhraseHashes, users } from '@everydaily/shared/db';
import { db } from '../db';
import { HttpError } from '../session';
import {
  checkUsername,
  normalizeUsername,
  USERNAME_MESSAGES,
  type UsernameProblem,
} from './username';

export type Availability =
  | { available: true; username: string }
  | { available: false; reason: UsernameProblem | 'taken'; message: string };

export async function usernameAvailability(raw: string): Promise<Availability> {
  const username = normalizeUsername(raw);
  const problem = checkUsername(username);
  if (problem) return { available: false, reason: problem, message: USERNAME_MESSAGES[problem] };
  const taken = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (taken.length) return { available: false, reason: 'taken', message: USERNAME_MESSAGES.taken };
  return { available: true, username };
}

export interface NewCredential {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  aaguid: string | null;
  nickname: string;
}

function isUniqueViolation(err: unknown, constraint: string) {
  const e = err as {
    code?: string;
    constraint_name?: string;
    cause?: { code?: string; constraint_name?: string };
  };
  const code = e.cause?.code ?? e.code;
  const name = e.cause?.constraint_name ?? e.constraint_name;
  return code === '23505' && (!name || name === constraint);
}

/** Creates user + first passkey + recovery hash atomically. */
export async function createAccount(input: {
  userId: string;
  username: string;
  timezone: string;
  credential: NewCredential;
  recoveryHash: string;
}) {
  try {
    await db().transaction(async (tx) => {
      await tx
        .insert(users)
        .values({ id: input.userId, username: input.username, timezone: input.timezone });
      await tx.insert(passkeyCredentials).values({
        userId: input.userId,
        credentialId: input.credential.id,
        ...credentialColumns(input.credential),
      });
      await tx
        .insert(recoveryPhraseHashes)
        .values({ userId: input.userId, hash: input.recoveryHash });
    });
  } catch (err) {
    if (isUniqueViolation(err, 'users_username_key')) {
      throw new HttpError(
        409,
        'username_taken',
        'Someone grabbed that name a moment ago. Pick another one.',
      );
    }
    if (isUniqueViolation(err, 'passkey_credentials_credential_id_key')) {
      throw new HttpError(409, 'passkey_exists', 'That passkey is already registered.');
    }
    throw err;
  }
}

export function credentialColumns(c: NewCredential) {
  return {
    publicKey: c.publicKey,
    counter: c.counter,
    transports: c.transports,
    deviceType: c.deviceType,
    backedUp: c.backedUp,
    aaguid: c.aaguid,
    nickname: c.nickname,
  };
}
