import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { friendByUsername } from '@/server/friends';
import { requireSession } from '@/server/session';

/**
 * Checked outside the page's loading boundary so a non-friend gets a real 404 (a notFound()
 * after streaming starts would still answer 200).
 */
export default async function FriendLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ username: string }>;
}) {
  const [{ username }, { user }] = await Promise.all([params, requireSession()]);
  if (!(await friendByUsername(user.id, username))) notFound();
  return children;
}
