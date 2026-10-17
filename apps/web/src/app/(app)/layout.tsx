import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getSession } from '@/server/session';

/** Everything in (app) requires a session. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await getSession())) {
    const path = (await headers()).get('x-pathname') ?? '/today';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return <AppShell>{children}</AppShell>;
}
