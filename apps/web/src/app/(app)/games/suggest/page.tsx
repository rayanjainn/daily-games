import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canSubmitGames } from '@/server/roles';
import { requireSession } from '@/server/session';
import { SuggestForm } from './suggest-form';

export const metadata: Metadata = { title: 'Suggest a game' };

export default async function SuggestPage() {
  const { user } = await requireSession();
  if (!canSubmitGames(user)) notFound();
  return <SuggestForm />;
}
