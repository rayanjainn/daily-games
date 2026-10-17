import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { safeNext } from '@/server/redirect';
import { getSession } from '@/server/session';
import { PairStart } from './pair-start';

export const metadata: Metadata = { title: 'Sign in with another device' };

export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  return (
    <AuthShell>
      <PairStart next={next} />
    </AuthShell>
  );
}
