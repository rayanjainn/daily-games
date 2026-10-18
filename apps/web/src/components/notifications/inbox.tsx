'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

export interface InboxItem {
  id: string;
  title: string;
  body: string | null;
  url: string;
  createdAt: string;
  read: boolean;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export function Inbox({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [read, setRead] = useState<Set<string>>(new Set());
  const unread = items.filter((i) => !i.read && !read.has(i.id));

  async function mark(ids: string[] | 'all') {
    try {
      await api('/api/notifications', { ids });
      setRead((r) => new Set([...r, ...(ids === 'all' ? items.map((i) => i.id) : ids)]));
      router.refresh();
    } catch {
      // Marking is a convenience; the item still opens.
    }
  }

  if (!items.length)
    return (
      <Card className="p-6 text-center text-ink-soft" data-testid="inbox-empty">
        Nothing yet. Friend requests, replies and decisions on what you submitted show up here.
      </Card>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft" role="status">
          {unread.length ? `${unread.length} unread` : 'All caught up'}
        </p>
        {unread.length ? (
          <Button size="sm" variant="secondary" onClick={() => void mark('all')}>
            <Check className="size-4" aria-hidden /> Mark all read
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2.5" aria-label="Notifications">
        {items.map((i) => {
          const isUnread = !i.read && !read.has(i.id);
          return (
            <li key={i.id}>
              <Link
                href={i.url}
                onClick={() => isUnread && void mark([i.id])}
                className="block rounded-lg border-2 border-line-soft bg-surface-2/60 p-3 hover:bg-surface-2"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{i.title}</span>
                  {isUnread ? <Badge tone="pop">New</Badge> : null}
                </span>
                {i.body ? (
                  <span className="mt-0.5 block text-sm text-ink-soft">{i.body}</span>
                ) : null}
                <span className="mt-0.5 block text-xs text-ink-soft">{when(i.createdAt)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
