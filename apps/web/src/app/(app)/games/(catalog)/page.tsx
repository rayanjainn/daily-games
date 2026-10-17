import type { Metadata } from 'next';
import { followedGameIds, listGames, toCatalogGame } from '@/server/catalog';
import { canSubmitGames } from '@/server/roles';
import { requireSession } from '@/server/session';
import { CatalogView, type InitialFilter } from './catalog-view';

export const metadata: Metadata = { title: 'Games' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function GamesPage({ searchParams }: { searchParams: SP }) {
  const { user } = await requireSession();
  const [rows, followed, sp] = await Promise.all([
    listGames(),
    followedGameIds(user.id),
    searchParams,
  ]);
  const now = new Date();
  const games = rows.map((g) => toCatalogGame(g, user.timezone, now));
  const initial: InitialFilter = {
    q: one(sp.q) ?? '',
    category: one(sp.category),
    difficulty: one(sp.difficulty),
    tier: one(sp.tier),
    embed: one(sp.embed),
    following: one(sp.following) === '1',
  };
  return (
    <CatalogView
      games={games}
      followedIds={[...followed]}
      initial={initial}
      canSuggest={canSubmitGames(user)}
    />
  );
}
