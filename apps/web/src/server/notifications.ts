import 'server-only';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  notifications,
  users,
  type NOTIFICATION_KINDS,
} from '@everydaily/shared/db';
import { db } from './db';

type Kind = (typeof NOTIFICATION_KINDS)[number];

const KEEP_DAYS = 90;

/**
 * Adds an inbox item. Best effort: a notification must never make the action that caused it fail,
 * so errors are logged and swallowed.
 */
export async function notify(
  userId: string | null | undefined,
  n: { kind: Kind; title: string; body?: string; url: string },
  actorId?: string,
) {
  if (!userId || userId === actorId) return;
  try {
    await db()
      .insert(notifications)
      .values({
        userId,
        kind: n.kind,
        title: n.title.slice(0, 160),
        body: n.body?.slice(0, 200),
        url: n.url,
      });
    await db()
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          lt(notifications.createdAt, new Date(Date.now() - KEEP_DAYS * 86400_000)),
        ),
      );
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'error', msg: 'notify failed', kind: n.kind, error: String(err) }),
    );
  }
}

export async function usernameOf(userId: string): Promise<string> {
  const [u] = await db().select({ u: users.username }).from(users).where(eq(users.id, userId));
  return u?.u ?? 'Someone';
}

export async function unreadCount(userId: string): Promise<number> {
  const [r] = await db()
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function listNotifications(userId: string, limit = 50) {
  const rows = await db()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    url: r.url,
    createdAt: r.createdAt.toISOString(),
    read: r.readAt !== null,
  }));
}

/** Marks some (or all) of a player's items as read. Only their own rows can change. */
export async function markRead(userId: string, ids: string[] | 'all') {
  const own = and(eq(notifications.userId, userId), isNull(notifications.readAt));
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(ids === 'all' ? own : and(own, inArray(notifications.id, ids)));
}
