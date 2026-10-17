import { attributionLine, getGameBySlug, toCatalogGame } from '@/server/catalog';
import { HttpError, query } from '@/server/http';
import { getSession } from '@/server/session';

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return query(async () => {
    const game = await getGameBySlug(slug);
    if (!game || game.status === 'archived')
      throw new HttpError(404, 'not_found', 'Game not found.');
    const tz = (await getSession())?.user.timezone ?? 'UTC';
    return {
      game: {
        ...toCatalogGame(game, tz),
        attribution: attributionLine(game.publisher),
        resetNote: game.resetNote,
      },
    };
  })(req);
}
