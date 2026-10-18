import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { getSession } from '@/server/session';
import { freshUsername } from '@/server/auth/accounts';
import { SignupWizard } from './signup-wizard';

export const metadata: Metadata = { title: 'Start playing' };

export default async function StartPage() {
  if (await getSession()) redirect('/today');
  const suggestion = await freshUsername();
  return (
    <AuthShell>
      <SignupWizard initialSuggestion={suggestion} />
    </AuthShell>
  );
}
