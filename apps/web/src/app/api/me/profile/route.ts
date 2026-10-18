import { z } from 'zod';
import { eq, sql, users } from '@everydaily/shared/db';
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
  /** Feel of the app: merged into what is already saved. */
  prefs: z
    .object({
      sound: z.boolean().optional(),
      haptics: z.boolean().optional(),
      reducedMotion: z.boolean().optional(),
    })
    .strict()
    .optional(),
});

export const PATCH = mutation(body, async ({ prefs, ...input }) => {
  const { user } = await requireSession();
  await db()
    .update(users)
    .set({
      ...input,
      ...(prefs ? { prefs: sql`${users.prefs} || ${JSON.stringify(prefs)}::jsonb` } : {}),
    })
    .where(eq(users.id, user.id));
  return { ok: true };
});
