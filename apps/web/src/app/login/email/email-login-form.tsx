'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Notice, StepHeading } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useHydrated } from '@/lib/use-hydrated';

export function EmailLoginForm({ next }: { next: string }) {
  const hydrated = useHydrated();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section>
      <StepHeading title="Sign in with email">
        We’ll send a one-time link to the email on your account. It works for 15 minutes.
      </StepHeading>
      {sent ? (
        <Notice tone="info">
          If that address is confirmed on an account, a sign-in link is on its way. Check your
          inbox.
        </Notice>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api('/api/auth/email/request', { email });
              setSent(true);
            } catch (err) {
              setError(
                err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <Field label="Email">
              {({ id }) => (
                <Input
                  id={id}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              )}
            </Field>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <Button type="submit" size="lg" block loading={busy} disabled={!hydrated}>
              Email me a link
            </Button>
          </Card>
        </form>
      )}
      <p className="mt-6 text-center">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-display font-semibold underline decoration-pop decoration-2 underline-offset-4"
        >
          Back to passkey sign-in
        </Link>
      </p>
    </section>
  );
}
