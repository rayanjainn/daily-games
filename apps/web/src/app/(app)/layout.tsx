import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { PrefsSync } from '@/components/theme/prefs-sync';
import { AppShell } from '@/components/shell/app-shell';
import { hasRole } from '@/server/roles';
import { getSession } from '@/server/session';

/** Everything in (app) requires a session. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    const path = (await headers()).get('x-pathname') ?? '/today';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return (
    <AppShell isMod={hasRole(session.user, 'mod')}>
      <PrefsSync prefs={session.user.prefs} />
      {children}
    </AppShell>
  );
}
