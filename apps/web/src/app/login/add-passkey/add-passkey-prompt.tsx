'use client';

import { Fingerprint } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Notice, StepHeading } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { addPasskey } from '@/lib/passkeys';

export function AddPasskeyPrompt({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section>
      <StepHeading title="You're in!">
        Add a passkey on this device so next time is one tap, no phrase needed.
      </StepHeading>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button
          size="lg"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const res = await addPasskey();
            setBusy(false);
            if (res.ok) router.replace(next);
            else setError(res.message);
          }}
        >
          <Fingerprint aria-hidden /> Add a passkey
        </Button>
        <Button variant="ghost" onClick={() => router.replace(next)}>
          Not now
        </Button>
      </Card>
    </section>
  );
}
