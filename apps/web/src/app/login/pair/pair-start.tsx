'use client';

import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Notice, StepHeading } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';

interface Pairing {
  url: string;
  number: number;
  qr: string;
  expiresAt: string;
}
type Status = 'pending' | 'approved' | 'denied' | 'consumed' | 'expired';

export function PairStart({ next }: { next: string }) {
  const router = useRouter();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  const begin = useCallback(async () => {
    setError(null);
    setStatus('pending');
    try {
      setPairing(await api<Pairing>('/api/auth/pair/start', {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start. Please try again.');
    }
  }, []);

  useEffect(() => {
    void begin();
  }, [begin]);

  // Poll every two seconds while waiting.
  useEffect(() => {
    if (!pairing || status !== 'pending') return;
    const tick = async () => {
      try {
        const { status: s } = await api<{ status: Status }>('/api/auth/pair/status');
        if (s === 'approved') {
          await api('/api/auth/pair/consume', {});
          router.replace(`/login/add-passkey?next=${encodeURIComponent(next)}`);
          return;
        }
        setStatus(s);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Lost connection. Retrying…');
      }
    };
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [pairing, status, next, router]);

  useEffect(() => {
    if (!pairing) return;
    const update = () =>
      setLeft(Math.max(0, Math.round((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [pairing]);

  const ended =
    status === 'denied' || status === 'expired' || (status === 'pending' && pairing && left === 0);

  return (
    <section>
      <StepHeading title="Sign in with another device">
        Use a phone or computer where you&apos;re already signed in.
      </StepHeading>
      <Card className="flex flex-col items-center gap-5 p-5 text-center sm:p-6" aria-live="polite">
        {!pairing && !error ? (
          <div
            className="size-56 animate-pulse rounded-lg bg-surface-3"
            aria-label="Preparing code"
          />
        ) : null}
        {pairing && !ended ? (
          <>
            <ol className="flex flex-col gap-1 text-left text-sm text-ink-soft">
              <li>1. Scan this code with your signed-in device (or open the link).</li>
              <li>2. When asked, pick the number below.</li>
            </ol>
            <img
              src={pairing.qr}
              alt="QR code to approve this sign-in"
              className="size-56 rounded-lg border-[length:var(--bw)] border-line bg-white p-2 shadow-lift-sm"
            />
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-wider text-ink-soft">
                Your number
              </p>
              <p className="font-display text-6xl font-bold tabular-nums" data-testid="pair-number">
                {pairing.number}
              </p>
            </div>
            <p className="break-all text-xs text-ink-soft">
              Or open{' '}
              <span className="font-mono text-ink" data-testid="pair-url">
                {pairing.url}
              </span>
            </p>
            <p className="font-display text-sm font-semibold text-ink-soft">
              Waiting for approval · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </p>
          </>
        ) : null}
        {ended ? (
          <>
            <Notice tone={status === 'denied' ? 'danger' : 'warn'} className="w-full">
              {status === 'denied'
                ? 'The request was declined on your other device.'
                : 'The code expired before it was approved.'}
            </Notice>
            <Button onClick={() => void begin()}>
              <RotateCcw aria-hidden /> Start again
            </Button>
          </>
        ) : null}
        {error ? (
          <Notice tone="danger" className="w-full">
            {error}
          </Notice>
        ) : null}
      </Card>
      <p className="mt-6 text-center">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-display font-semibold underline decoration-pop decoration-2 underline-offset-4"
        >
          Back to sign-in
        </Link>
      </p>
    </section>
  );
}
