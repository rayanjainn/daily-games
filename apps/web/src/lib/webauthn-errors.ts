/** Human copy for errors thrown by navigator.credentials (via @simplewebauthn/browser). */
export function passkeyErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const code = (err as { code?: string })?.code;
  if (name === 'NotAllowedError' || code === 'ERROR_CEREMONY_ABORTED') {
    return 'The passkey prompt was closed or timed out. Try again when you are ready.';
  }
  if (name === 'InvalidStateError' || code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
    return 'This device already has a passkey for this account.';
  }
  if (name === 'SecurityError')
    return 'Passkeys are blocked on this address. Make sure you are on the real site.';
  if (name === 'NotSupportedError')
    return 'This browser does not support passkeys. Try a recent Chrome, Safari, Edge or Firefox.';
  return 'Something went wrong with the passkey. Please try again.';
}
