import { z } from 'zod';
import { markBadgesSeen } from '@/server/badges';
import { mutation } from '@/server/http';
import { requireSession } from '@/server/session';

/** The player has seen their badges; nothing to send, the server knows what they've reached. */
export const POST = mutation(z.object({}), async () => {
  const { user } = await requireSession();
  await markBadgesSeen(user.id);
  return { ok: true };
});
