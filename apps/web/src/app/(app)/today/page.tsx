import type { Metadata } from 'next';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const { user } = await requireSession();
  return (
    <>
      <h1 className="text-3xl">Hi, {user.username}</h1>
      <p className="mt-2 text-ink-soft">Your daily checklist will live here.</p>
    </>
  );
}
