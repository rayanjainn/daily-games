import type { Metadata } from 'next';
import { asc, games } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { AdminGameList } from './admin-game-list';

export const metadata: Metadata = { title: 'Edit games' };

export default async function AdminGamesPage() {
  const rows = await db()
    .select({
      slug: games.slug,
      name: games.name,
      publisher: games.publisher,
      tier: games.tier,
      status: games.status,
      icon: games.icon,
      accentColor: games.accentColor,
      adminEditedAt: games.adminEditedAt,
    })
    .from(games)
    .orderBy(asc(games.name));
  return (
    <AdminGameList
      games={rows.map((g) => ({
        ...g,
        edited: Boolean(g.adminEditedAt),
        adminEditedAt: undefined,
      }))}
    />
  );
}
