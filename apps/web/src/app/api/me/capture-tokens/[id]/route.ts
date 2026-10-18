import { z } from 'zod';
import { and, captureTokens, eq, isNull } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { enforceLimit, HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return mutation(z.object({}), async () => {
    const { user } = await requireSession();
    await enforceLimit('capture-token-edit', user.id);
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Token not found.');
    const res = await db()
      .update(captureTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(captureTokens.id, id),
          eq(captureTokens.userId, user.id),
          isNull(captureTokens.revokedAt),
        ),
      )
      .returning({ id: captureTokens.id });
    if (!res.length) throw new HttpError(404, 'not_found', 'Token not found.');
    return { ok: true };
  })(req);
}
