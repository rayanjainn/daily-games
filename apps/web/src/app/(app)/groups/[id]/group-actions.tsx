'use client';

import { Copy, LogOut, Pencil, RefreshCw, Trash2, UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { GroupRole } from '@everydaily/shared/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

export function InviteLink({
  groupId,
  url,
  canReplace,
}: {
  groupId: string;
  url: string;
  canReplace: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-line-soft p-3">
      <p className="text-sm font-semibold">Invite link</p>
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 break-all rounded-md bg-surface-2 px-2 py-1.5 text-sm"
          data-testid="invite-link"
        >
          {url}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast({ tone: 'success', title: 'Invite link copied' });
            } catch {
              toast({ tone: 'error', title: 'Copy blocked. Select the link and copy it.' });
            }
          }}
        >
          <Copy aria-hidden /> Copy
        </Button>
        {canReplace ? (
          <Button
            size="sm"
            variant="ghost"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/groups/${groupId}`, { regenerateInvite: true }, 'PATCH');
                toast({ tone: 'info', title: 'New link made. The old one no longer works.' });
                router.refresh();
              } catch (err) {
                toast({ tone: 'error', title: errorText(err) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw aria-hidden /> New link
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function GroupManage({
  groupId,
  name,
  role,
}: {
  groupId: string;
  name: string;
  role: GroupRole;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {role !== 'member' ? <Rename groupId={groupId} name={name} /> : null}
      <Confirm
        trigger={
          <>
            <LogOut aria-hidden /> Leave
          </>
        }
        title={`Leave ${name}?`}
        description={
          role === 'owner'
            ? 'The longest-standing member becomes the owner. If nobody is left, the group is deleted.'
            : 'You can rejoin with an invite link.'
        }
        confirm="Leave"
        path={`/api/groups/${groupId}/leave`}
        method="POST"
        after="/groups"
      />
      {role === 'owner' ? (
        <Confirm
          trigger={
            <>
              <Trash2 aria-hidden /> Delete
            </>
          }
          title={`Delete ${name}?`}
          description="The group and its board disappear for everyone. Results stay in each player's own stats."
          confirm="Delete group"
          path={`/api/groups/${groupId}`}
          method="DELETE"
          after="/groups"
        />
      ) : null}
    </div>
  );
}

function Rename({ groupId, name }: { groupId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/groups/${groupId}`, { name: value }, 'PATCH');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Pencil aria-hidden /> Rename
        </Button>
      </DialogTrigger>
      <DialogContent title="Rename group">
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <Field label="Group name" error={error ?? undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={value}
                maxLength={40}
                onChange={(e) => setValue(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <Button type="submit" loading={busy} className="self-start">
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveMember({
  groupId,
  userId,
  name,
}: {
  groupId: string;
  userId: string;
  name: string;
}) {
  return (
    <Confirm
      trigger={
        <>
          <UserMinus aria-hidden /> Remove
        </>
      }
      label={`Remove ${name}`}
      title={`Remove ${name}?`}
      description="They can rejoin only with a new invite link."
      confirm="Remove"
      path={`/api/groups/${groupId}/members/${userId}`}
      method="DELETE"
    />
  );
}

function Confirm({
  trigger,
  label,
  title,
  description,
  confirm,
  path,
  method,
  after,
}: {
  trigger: React.ReactNode;
  label?: string;
  title: string;
  description: string;
  confirm: string;
  path: string;
  method: 'POST' | 'DELETE';
  after?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={label}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(path, {}, method);
                setOpen(false);
                if (after) router.push(after);
                router.refresh();
              } catch (err) {
                toast({ tone: 'error', title: errorText(err) });
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
