import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ensureCommunity } from '@/server/community';
import { requireSession } from '@/server/session';

/** Unknown or archived games have no board: a real 404, checked before anything streams. */
export default async function CommunityLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }] = await Promise.all([params, requireSession()]);
  if (!(await ensureCommunity(slug))) notFound();
  return children;
}
