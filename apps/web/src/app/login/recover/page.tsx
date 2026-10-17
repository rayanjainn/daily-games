import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { safeNext } from '@/server/redirect';
import { RecoverForm } from './recover-form';

export const metadata: Metadata = { title: 'Recover your account' };

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <AuthShell>
      <RecoverForm next={safeNext((await searchParams).next)} />
    </AuthShell>
  );
}
