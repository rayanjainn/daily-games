import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser';
import { api, ApiError } from './api';
import { passkeyErrorMessage } from './webauthn-errors';

/** Registers another passkey for the signed-in user. */
export async function addPasskey(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { options } = await api<{ options: PublicKeyCredentialCreationOptionsJSON }>(
      '/api/me/passkeys/options',
      {},
    );
    const response = await startRegistration({ optionsJSON: options });
    await api('/api/me/passkeys/verify', { response });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof ApiError ? err.message : passkeyErrorMessage(err) };
  }
}
