'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Header link to the inbox, with the unread count when there is one. The count is fetched after
 * the page has loaded, so it never holds up the page itself (it is one more database round trip).
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch('/api/notifications?count=1', { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { unread?: number } | null) => {
          if (live && d && typeof d.unread === 'number') setUnread(d.unread);
        })
        .catch(() => {});
    void load();
    window.addEventListener('focus', load);
    return () => {
      live = false;
      window.removeEventListener('focus', load);
    };
    // Opening any page is a good moment to look again.
  }, [pathname]);

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
