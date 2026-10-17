'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

export function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const g = await api<{ id: string }>('/api/groups/join', { code });
            router.push(`/groups/${g.id}`);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not join. Try again.');
            setBusy(false);
          }
        }}
      >
        Join group
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
