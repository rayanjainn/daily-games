import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { emailEnabled } from '@/server/email';
import { safeNext } from '@/server/redirect';
import { EmailLoginForm } from './email-login-form';

export const metadata: Metadata = { title: 'Sign in with email' };

export default async function EmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!emailEnabled()) notFound();
  return (
    <AuthShell>
      <EmailLoginForm next={safeNext((await searchParams).next)} />
    </AuthShell>
  );
}
