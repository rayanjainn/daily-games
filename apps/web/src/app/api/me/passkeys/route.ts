import { asc, eq, passkeyCredentials } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { query } from '@/server/http';
import { requireSession } from '@/server/session';

export const GET = query(async () => {
  const { user } = await requireSession();
  const rows = await db()
    .select({
      id: passkeyCredentials.id,
      nickname: passkeyCredentials.nickname,
      deviceType: passkeyCredentials.deviceType,
      backedUp: passkeyCredentials.backedUp,
      transports: passkeyCredentials.transports,
      createdAt: passkeyCredentials.createdAt,
      lastUsedAt: passkeyCredentials.lastUsedAt,
    })
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, user.id))
    .orderBy(asc(passkeyCredentials.createdAt));
  return { passkeys: rows };
});
