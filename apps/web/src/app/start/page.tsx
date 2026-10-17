import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { getSession } from '@/server/session';
import { usernameAvailability } from '@/server/auth/accounts';
import { suggestUsername } from '@/server/auth/username';
import { SignupWizard } from './signup-wizard';

export const metadata: Metadata = { title: 'Start playing' };

export default async function StartPage() {
  if (await getSession()) redirect('/today');
  let suggestion = suggestUsername();
  for (let i = 0; i < 5 && !(await usernameAvailability(suggestion)).available; i++)
    suggestion = suggestUsername();
  return (
    <AuthShell>
      <SignupWizard initialSuggestion={suggestion} />
    </AuthShell>
  );
}
