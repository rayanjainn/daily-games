import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getGameBySlug } from '@/server/catalog';

type Params = Promise<{ slug: string }>;

/**
 * Checks the game exists before the page's loading state streams, so unknown and archived
 * games answer with a real 404 instead of a 200 that renders "not found".
 */
export default async function GameLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const game = await getGameBySlug((await params).slug);
  if (!game || game.status === 'archived') notFound();
  return children;
}
