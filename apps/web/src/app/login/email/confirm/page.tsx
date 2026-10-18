import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { safeNext } from '@/server/redirect';
import { ConfirmEmailLogin } from './confirm-email-login';

export const metadata: Metadata = { title: 'Finish signing in', robots: { index: false } };

export default async function ConfirmEmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const { token, next } = await searchParams;
  return (
    <AuthShell>
      <ConfirmEmailLogin token={typeof token === 'string' ? token : ''} next={safeNext(next)} />
    </AuthShell>
  );
}
