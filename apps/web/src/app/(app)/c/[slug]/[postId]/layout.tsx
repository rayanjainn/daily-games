import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { postView } from '@/server/community';
import { requireSession } from '@/server/session';

/** Missing (or, for non-moderators, removed) posts are a real 404. */
export default async function PostLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string; postId: string }>;
}) {
  const [{ slug, postId }, { user }] = await Promise.all([params, requireSession()]);
  const post = await postView(user, postId);
  if (!post || post.community.slug !== slug) notFound();
  return children;
}
