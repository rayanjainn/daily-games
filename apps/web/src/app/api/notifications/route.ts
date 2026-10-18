import { z } from 'zod';
import { enforceLimit, mutation, query } from '@/server/http';
import { listNotifications, markRead, unreadCount } from '@/server/notifications';
import { requireSession } from '@/server/session';

export const GET = query(async () => {
  const { user } = await requireSession();
  return { unread: await unreadCount(user.id), items: await listNotifications(user.id) };
});

export const POST = mutation(
  z.object({ ids: z.union([z.literal('all'), z.array(z.string().uuid()).max(100)]) }).strict(),
  async ({ ids }) => {
    const { user } = await requireSession();
    await enforceLimit('notification-read', user.id);
    await markRead(user.id, ids);
    return { unread: await unreadCount(user.id) };
  },
);
