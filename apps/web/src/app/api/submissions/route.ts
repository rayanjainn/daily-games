import { gameSubmissionSchema } from '@everydaily/shared/catalog/rules';
import { createSubmission } from '@/server/catalog/submissions';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { canSubmitGames } from '@/server/roles';
import { requireSession } from '@/server/session';

export const POST = mutation(gameSubmissionSchema, async (input) => {
  const { user } = await requireSession();
  if (!canSubmitGames(user))
    throw new HttpError(403, 'submissions_closed', 'Game suggestions are not open yet.');
  await enforceLimit('submission', user.id);
  return createSubmission(user, input);
});
