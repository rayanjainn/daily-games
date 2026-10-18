import { z } from 'zod';
import { eq, users } from '@everydaily/shared/db';
import { isValidTimeZone } from '@everydaily/shared/time/zoned';
import { db } from '@/server/db';
import { mutation } from '@/server/http';
import { requireSession } from '@/server/session';

const body = z.object({
  displayName: z
    .string()
    .trim()
    .max(40)
    .transform((s) => s || null)
    .optional(),
  timezone: z.string().max(64).refine(isValidTimeZone, 'Unknown timezone').optional(),
  /** Hide friends' and groups' results for a puzzle until you've logged yours. */
  spoilerSafe: z.boolean().optional(),
  /** Appear by name on the global daily boards of the native games. */
  showOnRankings: z.boolean().optional(),
});

export const PATCH = mutation(body, async (input) => {
  const { user } = await requireSession();
  await db().update(users).set(input).where(eq(users.id, user.id));
  return { ok: true };
});
