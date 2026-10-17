'use client';

import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { KeyRound, ScrollText, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Notice, StepHeading } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { passkeyErrorMessage } from '@/lib/webauthn-errors';

async function signIn(autofill: boolean) {
  const { options } = await api<{ options: PublicKeyCredentialRequestOptionsJSON }>(
    '/api/auth/login/options',
    {},
  );
  const response = await startAuthentication({
    optionsJSON: options,
    useBrowserAutofill: autofill,
  });
  await api('/api/auth/login/verify', { response });
}

export function LoginPanel({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Conditional UI: passkeys show up in the name field's autofill suggestions.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      if (!(await browserSupportsWebAuthnAutofill())) return;
      try {
        await signIn(true);
        router.replace(next);
      } catch (err) {
        // Aborted when the button starts its own request; any other failure is shown.
        const name = (err as { name?: string }).name;
        if (name !== 'AbortError' && (err as { code?: string }).code !== 'ERROR_CEREMONY_ABORTED') {
          setError(err instanceof ApiError ? err.message : passkeyErrorMessage(err));
        }
      }
    })();
  }, [next, router]);

  async function withButton() {
    setBusy(true);
    setError(null);
    try {
      await signIn(false);
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : passkeyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <StepHeading title="Welcome back">
        Sign in with the passkey you made on this or another device.
      </StepHeading>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <Field
          label="Player name"
          hint="Pick your passkey from the suggestions, or use the button."
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="username"
              autoComplete="username webauthn"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button size="lg" block loading={busy} onClick={withButton}>
          <KeyRound aria-hidden /> Sign in with passkey
        </Button>
      </Card>

      <div className="mt-6 flex flex-col gap-2">
        <p className="text-center font-display text-sm font-semibold text-ink-soft">
          Other ways in
        </p>
        <Button asChild variant="secondary">
          <Link href={`/login/pair?next=${encodeURIComponent(next)}`}>
            <Smartphone aria-hidden /> Use a device that&apos;s signed in
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/login/recover?next=${encodeURIComponent(next)}`}>
            <ScrollText aria-hidden /> Use my recovery phrase
          </Link>
        </Button>
      </div>
      <p className="mt-8 text-center text-ink-soft">
        New here?{' '}
        <Link
          href="/start"
          className="font-display font-semibold text-ink underline decoration-pop decoration-2 underline-offset-4"
        >
          Start playing
        </Link>
      </p>
    </section>
  );
}
