import { CheckCircle2, MailWarning } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirmEmailToken, type VerifyOutcome } from '@/server/email';

export const metadata: Metadata = { title: 'Confirm email', robots: { index: false } };

const COPY: Record<VerifyOutcome, { title: string; body: string }> = {
  verified: {
    title: 'Email confirmed',
    body: 'Thanks! You can now turn on email reminders in Settings.',
  },
  invalid: {
    title: "That link doesn't work",
    body: 'It may have been used already. Send a new one from Settings.',
  },
  expired: {
    title: 'That link has expired',
    body: 'Links work for 24 hours. Send a new one from Settings.',
  },
  changed: {
    title: 'The email was changed',
    body: 'This link was for an address that is no longer on the account.',
  },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const outcome = await confirmEmailToken(typeof token === 'string' ? token : '');
  const copy = COPY[outcome];
  return (
    <AuthShell>
      <Card
        className="mt-6 flex flex-col items-center gap-4 p-8 text-center"
        data-testid="verify-email"
      >
        <span
          className={
            outcome === 'verified'
              ? 'grid size-16 place-items-center rounded-full border-[length:var(--bw)] border-line bg-mint text-on-mint shadow-lift-sm'
              : 'grid size-16 place-items-center rounded-full border-[length:var(--bw)] border-line bg-sun text-on-sun shadow-lift-sm'
          }
        >
          {outcome === 'verified' ? (
            <CheckCircle2 className="size-8" aria-hidden />
          ) : (
            <MailWarning className="size-8" aria-hidden />
          )}
        </span>
        <h1 className="text-3xl">{copy.title}</h1>
        <p className="text-ink-soft">{copy.body}</p>
        <Link href="/settings" className={buttonVariants({ size: 'lg' })}>
          Go to Settings
        </Link>
      </Card>
    </AuthShell>
  );
}
