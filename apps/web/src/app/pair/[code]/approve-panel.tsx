'use client';

import { CheckCircle2, Laptop, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Notice } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export function ApprovePanel({
  code,
  choices,
  device,
}: {
  code: string;
  choices: number[];
  device: string;
}) {
  const [state, setState] = useState<'choose' | 'busy' | 'approved' | 'denied' | 'error'>('choose');
  const [message, setMessage] = useState<string | null>(null);

  async function pick(number: number) {
    setState('busy');
    try {
      await api('/api/auth/pair/approve', { code, number });
      setState('approved');
    } catch (err) {
      setState('error');
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  if (state === 'approved') {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <p className="font-display text-xl font-semibold">Approved</p>
        <p className="text-ink-soft">
          Your other device is signing in now. You can close this page.
        </p>
        <Button asChild variant="secondary">
          <Link href="/today">Back to today</Link>
        </Button>
      </Card>
    );
  }
  if (state === 'denied' || state === 'error') {
    return (
      <Notice tone="danger" className="flex flex-col gap-1">
        {state === 'denied' ? 'Declined. Nobody was signed in.' : message}
      </Notice>
    );
  }

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-center gap-3 rounded-md bg-surface-2 p-3">
        <Laptop className="size-6 shrink-0 text-ink-soft" aria-hidden />
        <p className="text-sm">
          <span className="font-display font-semibold">{device}</span>
          <br />
          <span className="text-ink-soft">requested just now</span>
        </p>
      </div>
      <Notice tone="warn">
        <span className="flex gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Only approve if you started this on a device you&apos;re holding right now. Never approve
          because someone asked you to.
        </span>
      </Notice>
      <fieldset>
        <legend className="mb-3 font-display font-semibold">
          Which number does the other device show?
        </legend>
        <div className="grid grid-cols-3 gap-3">
          {choices.map((n) => (
            <button
              key={n}
              type="button"
              disabled={state === 'busy'}
              onClick={() => void pick(n)}
              className={cn(
                'h-20 rounded-lg border-[length:var(--bw-thick)] border-line bg-sun font-display text-3xl font-bold text-on-sun tabular-nums shadow-lift-md',
                'transition-transform active:translate-y-[var(--lift-md)] active:shadow-none disabled:opacity-60',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <Button
        variant="ghost"
        onClick={async () => {
          await api('/api/auth/pair/deny', { code }).catch(() => {});
          setState('denied');
        }}
      >
        This wasn&apos;t me, decline
      </Button>
    </Card>
  );
}
