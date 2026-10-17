import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { membership } from '@/server/groups';
import { requireSession } from '@/server/session';

/** Members only; checked outside the loading boundary so others get a real 404. */
export default async function GroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { user }] = await Promise.all([params, requireSession()]);
  if (!(await membership(user.id, id))) notFound();
  return children;
}
