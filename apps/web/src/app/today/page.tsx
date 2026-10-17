import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/session';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/today');
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl">Hi, {session.user.username}</h1>
      <p className="mt-2 text-ink-soft">Your daily checklist will live here.</p>
    </main>
  );
}
