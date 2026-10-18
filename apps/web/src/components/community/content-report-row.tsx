'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

export interface ContentReport {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  postId: string;
  communitySlug: string;
  preview: string;
  targetStatus: string;
  reason: string;
  reporter: string | null;
  createdAt: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

/** One reported post or comment, with Remove and Dismiss (site and board moderators). */
export function ContentReportRow({ report: r }: { report: ContentReport }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function act(kind: 'remove' | 'dismiss') {
    setBusy(kind);
    try {
      if (kind === 'remove')
        await api(`/api/admin/content/${r.targetType}/${r.targetId}`, {
          action: 'remove',
          reason: r.reason,
        });
      else await api(`/api/admin/content-reports/${r.id}/dismiss`, {});
      toast({ tone: 'success', title: kind === 'remove' ? 'Removed' : 'Dismissed' });
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
      setBusy(null);
    }
  }
  return (
    <li>
      <Card lift="sm" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warn">{r.targetType === 'post' ? 'Post' : 'Comment'}</Badge>
            {r.targetStatus === 'removed' ? <Badge tone="danger">Already removed</Badge> : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.preview}</p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">Reason:</span> {r.reason}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            From {r.reporter ?? 'a deleted account'} · {when(r.createdAt)} ·{' '}
            <Link
              href={`/c/${r.communitySlug}/${r.postId}`}
              className="underline underline-offset-2"
              prefetch={false}
            >
              Open
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="danger"
            loading={busy === 'remove'}
            disabled={busy !== null}
            onClick={() => act('remove')}
          >
            Remove
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'dismiss'}
            disabled={busy !== null}
            onClick={() => act('dismiss')}
          >
            Dismiss
          </Button>
        </div>
      </Card>
    </li>
  );
}
