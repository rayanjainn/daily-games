import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { safeNext } from '@/server/redirect';
import { getSession } from '@/server/session';
import { LoginPanel } from './login-panel';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  return (
    <AuthShell>
      <LoginPanel next={next} />
    </AuthShell>
  );
}
