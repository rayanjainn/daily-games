'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Notice, StepHeading } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useHydrated } from '@/lib/use-hydrated';

export function RecoverForm({ next }: { next: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [username, setUsername] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section>
      <StepHeading title="Use your recovery phrase">
        Enter your player name and the six words you saved when you signed up.
      </StepHeading>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api('/api/auth/recover', { username, phrase });
            router.replace(`/login/add-passkey?next=${encodeURIComponent(next)}`);
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
          <Field label="Player name">
            {({ id }) => (
              <Input
                id={id}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            )}
          </Field>
          <Field
            label="Recovery phrase"
            hint="Six words in order, separated by spaces. The first four letters of each word are enough."
          >
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                aria-describedby={describedBy}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                rows={3}
                required
                className="font-display text-lg"
              />
            )}
          </Field>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button type="submit" size="lg" block loading={busy} disabled={!hydrated}>
            Sign in
          </Button>
        </Card>
      </form>
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
