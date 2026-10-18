import { z } from 'zod';
import { and, captureTokens, desc, eq, isNull } from '@everydaily/shared/db';
import { createCaptureToken } from '@/server/capture';
import { db } from '@/server/db';
import { enforceLimit, mutation, query } from '@/server/http';
import { requireSession } from '@/server/session';

export const GET = query(async () => {
  const { user } = await requireSession();
  const rows = await db()
    .select({
      id: captureTokens.id,
      label: captureTokens.label,
      createdAt: captureTokens.createdAt,
      lastUsedAt: captureTokens.lastUsedAt,
    })
    .from(captureTokens)
    .where(and(eq(captureTokens.userId, user.id), isNull(captureTokens.revokedAt)))
    .orderBy(desc(captureTokens.createdAt));
  return { tokens: rows };
});

export const POST = mutation(
  z.object({ label: z.string().trim().min(1).max(40) }).strict(),
  async ({ label }) => {
    const { user } = await requireSession();
    await enforceLimit('capture-token-edit', user.id);
    // The token is returned this once; only its hash is stored.
    return createCaptureToken(user.id, label);
  },
);
