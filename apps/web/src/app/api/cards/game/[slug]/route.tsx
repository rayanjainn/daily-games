import { followedAt, getGameBySlug } from '@/server/catalog';
import { gameCard } from '@/server/cards';
import { HttpError, query } from '@/server/http';
import { requireSession } from '@/server/session';
import { getGameStats } from '@/server/stats';

type Ctx = { params: Promise<{ slug: string }> };

/** The signed-in player's stat card for one game (PNG, never cached). */
export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return query(async () => {
    const { user } = await requireSession();
    const game = await getGameBySlug(slug);
    if (!game || game.status === 'archived')
      throw new HttpError(404, 'not_found', 'Game not found.');
    const view = await getGameStats(user, game, await followedAt(user.id, game.id));
    return gameCard({
      name: game.name,
      accentColor: game.accentColor,
      playerName: user.displayName ?? user.username,
      stats: view.stats,
      completion: game.scoringType === 'completion',
    });
  })(req);
}
