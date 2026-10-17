'use client';

import { Flag, Lock, RotateCcw, Trash2, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

/** Report, delete-your-own, and moderator actions for a post or comment. */
export function ContentMenu({
  type,
  id,
  mine,
  mod,
  status,
}: {
  type: 'post' | 'comment';
  id: string;
  mine: boolean;
  mod: boolean;
  status: 'visible' | 'removed' | 'locked';
}) {
  const router = useRouter();
  const toast = useToast();
  async function run(path: string, body: unknown, method: 'POST' | 'DELETE', done: string) {
    try {
      await api(path, body, method);
      toast({ tone: 'success', title: done });
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
    }
  }
  const small = 'h-7 px-2 text-xs';
  return (
    <div className="flex flex-wrap items-center gap-1">
      {!mine && status !== 'removed' ? <ReportButton type={type} id={id} /> : null}
      {mine && status !== 'removed' ? (
        <Button
          size="sm"
          variant="ghost"
          className={small}
          onClick={() => run(`/api/content/${type}/${id}`, {}, 'DELETE', 'Deleted')}
        >
          <Trash2 aria-hidden /> Delete
        </Button>
      ) : null}
      {mod ? (
        <>
          {status === 'removed' ? (
            <Button
              size="sm"
              variant="ghost"
              className={small}
              onClick={() =>
                run(`/api/admin/content/${type}/${id}`, { action: 'restore' }, 'POST', 'Restored')
              }
            >
              <RotateCcw aria-hidden /> Restore
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className={small}
              onClick={() =>
                run(`/api/admin/content/${type}/${id}`, { action: 'remove' }, 'POST', 'Removed')
              }
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          )}
          {type === 'post' && status !== 'removed' ? (
            <Button
              size="sm"
              variant="ghost"
              className={small}
              onClick={() =>
                run(
                  `/api/admin/content/post/${id}`,
                  { action: status === 'locked' ? 'unlock' : 'lock' },
                  'POST',
                  status === 'locked' ? 'Unlocked' : 'Locked',
                )
              }
            >
              {status === 'locked' ? <Unlock aria-hidden /> : <Lock aria-hidden />}
              {status === 'locked' ? 'Unlock' : 'Lock'}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ReportButton({ type, id }: { type: 'post' | 'comment'; id: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/reports/${type}/${id}`, { reason });
      setOpen(false);
      setReason('');
      toast({ tone: 'success', title: 'Thanks. A moderator will take a look.' });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
          <Flag aria-hidden /> Report
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Report this ${type}`}
        description="Spam, spoilers outside the daily thread, or anything unkind."
      >
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <Field label="What's wrong?" error={error ?? undefined}>
            {({ id: fid, describedBy, invalid }) => (
              <Textarea
                id={fid}
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <Button type="submit" loading={busy} disabled={!reason.trim()} className="self-start">
            Send report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
