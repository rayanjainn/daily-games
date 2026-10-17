import { getGameBySlug } from '@/server/catalog';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { existingResult, interpret, logInputSchema, summarize } from '@/server/results';
import { requireSession } from '@/server/session';

/** Parses without saving, so the player sees what will be logged (and any problem) first. */
export const POST = mutation(logInputSchema, async (input) => {
  const { user } = await requireSession();
  await enforceLimit('result-preview', user.id);
  const game = await getGameBySlug(input.slug);
  if (!game || game.status === 'archived') throw new HttpError(404, 'not_found', 'Game not found.');
  const r = interpret(game, input, user.timezone);
  const prev = await existingResult(user.id, game.id, r.puzzleNumber);
  return {
    puzzleNumber: game.numberingPublic ? r.puzzleNumber : null,
    puzzleDate: r.puzzleDate,
    solved: r.solved,
    summary: summarize(game, r),
    grid: typeof r.details.grid === 'string' ? r.details.grid : null,
    duplicate: Boolean(prev),
  };
});
