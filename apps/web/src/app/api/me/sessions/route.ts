import { and, desc, eq, gt, isNull, sessions } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { query } from '@/server/http';
import { requireSession } from '@/server/session';
import { describeDevice } from '@/server/auth/pairing';

export const GET = query(async () => {
  const { user, sessionId } = await requireSession();
  const rows = await db()
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      method: sessions.method,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.lastSeenAt));
  return {
    sessions: rows.map(({ userAgent, ...r }) => ({
      ...r,
      device: describeDevice(userAgent),
      current: r.id === sessionId,
    })),
  };
});
