import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { safeNext } from '@/server/redirect';
import { getSession } from '@/server/session';
import { AddPasskeyPrompt } from './add-passkey-prompt';

export const metadata: Metadata = { title: 'Add a passkey' };

export default async function AddPasskeyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (!(await getSession())) redirect(`/login?next=${encodeURIComponent(next)}`);
  return (
    <AuthShell>
      <AddPasskeyPrompt next={next} />
    </AuthShell>
  );
}
