import { Bell } from 'lucide-react';
import Link from 'next/link';

/** Header link to the inbox, with the unread count when there is one. */
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative grid size-10 place-items-center rounded-full border-[length:var(--bw)] border-line-soft text-ink hover:bg-surface-2"
    >
      <Bell className="size-5" aria-hidden />
      {unread ? (
        <span
          data-testid="unread-count"
          aria-hidden
          className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full border-2 border-paper bg-pop px-1 text-xs font-bold leading-5 text-on-pop"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
