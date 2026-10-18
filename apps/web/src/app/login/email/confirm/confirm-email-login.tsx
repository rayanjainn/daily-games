'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Notice, StepHeading } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { useHydrated } from '@/lib/use-hydrated';

/**
 * Signing in takes a tap, not just opening the link: mail scanners open links to check them, and
 * that must not use the link up.
 */
export function ConfirmEmailLogin({ token, next }: { token: string; next: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section>
      <StepHeading title="Finish signing in">Tap the button to sign in on this device.</StepHeading>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button
          size="lg"
          block
          loading={busy}
          disabled={!hydrated || !token}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api('/api/auth/email/confirm', { token });
              router.replace(`/login/add-passkey?next=${encodeURIComponent(next)}`);
            } catch (err) {
              setError(
                err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
              );
              setBusy(false);
            }
          }}
        >
          Sign in
        </Button>
      </Card>
      <p className="mt-6 text-center">
        <Link
          href="/login/email"
          className="font-display font-semibold underline decoration-pop decoration-2 underline-offset-4"
        >
          Send me a new link
        </Link>
      </p>
    </section>
  );
}
