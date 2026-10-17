import { getGameBySlug } from '@/server/catalog';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';
import { solutionInputSchema, submitSolution } from '@/server/solutions';

/** Shares the answer to a finished puzzle; it stays hidden until a moderator approves it. */
export const POST = mutation(solutionInputSchema, async (input) => {
  const { user } = await requireSession();
  await enforceLimit('solution-submit', user.id);
  const game = await getGameBySlug(input.slug);
  if (!game || game.status === 'archived') throw new HttpError(404, 'not_found', 'Game not found.');
  return submitSolution(user, game, input);
});
