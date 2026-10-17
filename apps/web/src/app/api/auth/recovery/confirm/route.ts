import { eq } from '@everydaily/shared/db';
import { z } from 'zod';
import { users } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';
import { checkConfirmation } from '@/server/auth/recovery';

const body = z.object({
  answers: z
    .array(z.object({ index: z.number().int().min(0).max(5), word: z.string().max(20) }))
    .length(2),
});

export const POST = mutation(body, async ({ answers }) => {
  const { user } = await requireSession();
  const res = await checkConfirmation(user.id, answers);
  if (res === 'expired') {
    throw new HttpError(
      410,
      'confirm_expired',
      'This check expired. Generate a new recovery phrase in Settings to finish.',
    );
  }
  if (res === 'wrong')
    throw new HttpError(400, 'confirm_wrong', "Those words don't match. Check your saved phrase.");
  await db().update(users).set({ recoveryConfirmedAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true };
});
