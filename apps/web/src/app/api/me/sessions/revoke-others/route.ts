import { z } from 'zod';
import { and, eq, isNull, ne, sessions } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { mutation } from '@/server/http';
import { requireSession } from '@/server/session';

export const POST = mutation(z.object({}), async () => {
  const { user, sessionId } = await requireSession();
  const res = await db()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(sessions.userId, user.id), ne(sessions.id, sessionId), isNull(sessions.revokedAt)),
    )
    .returning({ id: sessions.id });
  return { revoked: res.length };
});
