import { listGames, toCatalogGame } from '@/server/catalog';
import { query } from '@/server/http';
import { getSession } from '@/server/session';

/** The public catalog. Today's puzzle numbers use the player's timezone when signed in. */
export const GET = query(async () => {
  const tz = (await getSession())?.user.timezone ?? 'UTC';
  const now = new Date();
  return { games: (await listGames()).map((g) => toCatalogGame(g, tz, now)) };
});
