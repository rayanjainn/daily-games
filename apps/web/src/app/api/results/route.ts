import { getGameBySlug } from '@/server/catalog';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { logInputSchema, saveResult } from '@/server/results';
import { requireSession } from '@/server/session';

export const POST = mutation(logInputSchema, async (input) => {
  const { user } = await requireSession();
  await enforceLimit('result-log', user.id);
  const game = await getGameBySlug(input.slug);
  if (!game || game.status === 'archived') throw new HttpError(404, 'not_found', 'Game not found.');
  return saveResult(user, game, input);
});
