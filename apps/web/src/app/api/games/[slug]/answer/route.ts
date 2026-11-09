import { getGameBySlug } from '@/server/catalog';
import { revealAnswer } from '@/server/answers';
import { enforceLimit, HttpError, query } from '@/server/http';
import { requireSession } from '@/server/session';

/** GET ?date=YYYY-MM-DD: the publisher's answer, once the player has logged that puzzle. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return query(async () => {
    const { user } = await requireSession();
    await enforceLimit('answer-view', user.id);
    const date = new URL(req.url).searchParams.get('date') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new HttpError(400, 'invalid_input', 'Ask for a date like 2026-01-31.');
    const game = await getGameBySlug(slug);
    if (!game || game.status === 'archived')
      throw new HttpError(404, 'not_found', 'Game not found.');
    return revealAnswer(user, game, date);
  })(req);
}
