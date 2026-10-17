import { z } from 'zod';
import { and, eq, isNull, sessions } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { HttpError, mutation } from '@/server/http';
import { requireSession } from '@/server/session';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return mutation(z.object({}), async () => {
    const { user, sessionId } = await requireSession();
    if (!z.string().uuid().safeParse(id).success)
      throw new HttpError(404, 'not_found', 'Session not found.');
    if (id === sessionId)
      throw new HttpError(400, 'current_session', 'Use “Sign out” to end this session.');
    const res = await db()
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.userId, user.id), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    if (!res.length) throw new HttpError(404, 'not_found', 'Session not found.');
    return { ok: true };
  })(req);
}
