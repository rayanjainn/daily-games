import type { Metadata } from 'next';
import { Inbox } from '@/components/notifications/inbox';
import { listNotifications } from '@/server/notifications';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const { user } = await requireSession();
  const items = await listNotifications(user.id);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl sm:text-4xl">Notifications</h1>
      <Inbox items={items} />
    </div>
  );
}
