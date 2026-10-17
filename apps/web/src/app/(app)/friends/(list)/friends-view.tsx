'use client';

import { Ban, Check, Swords, UserPlus, UsersRound, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import type { FriendLists } from '@/server/friends';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

export function FriendsView({
  me,
  lists,
  children,
}: {
  me: string;
  lists: FriendLists;
  /** The friends leaderboard, rendered on the server. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl sm:text-4xl">Friends</h1>
        <p className="mt-1 text-ink-soft">
          Add friends by player name to compare results game by game.
        </p>
      </div>
      <Link
        href="/groups"
        className="flex items-center justify-between gap-3 rounded-lg border-[length:var(--bw)] border-line bg-sky p-4 text-on-sky shadow-lift-sm"
      >
        <span>
          <span className="block font-display text-lg font-semibold">Groups</span>
          <span className="text-sm">Private leaderboards for friends, family or a team.</span>
        </span>
        <UsersRound className="size-6 shrink-0" aria-hidden />
      </Link>
      <AddFriend me={me} />
      {children}
      {lists.incoming.length ? (
        <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="incoming-heading">
          <h2 id="incoming-heading" className="text-xl">
            Requests for you
          </h2>
          <ul className="divide-y-2 divide-line-soft" data-testid="incoming">
            {lists.incoming.map((p) => (
              <Person key={p.id} person={p}>
                <Action
                  path={`/api/friends/${p.id}/accept`}
                  label={`Accept ${p.username}`}
                  done="Friend added"
                >
                  <Check aria-hidden /> Accept
                </Action>
                <Action
                  path={`/api/friends/${p.id}`}
                  method="DELETE"
                  variant="ghost"
                  label={`Decline ${p.username}`}
                >
                  <X aria-hidden /> Decline
                </Action>
              </Person>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="friends-heading">
        <h2 id="friends-heading" className="text-xl">
          Your friends <span className="text-ink-soft">({lists.friends.length})</span>
        </h2>
        {lists.friends.length ? (
          <ul className="divide-y-2 divide-line-soft" data-testid="friends">
            {lists.friends.map((p) => (
              <Person
                key={p.id}
                person={p}
                note={p.playedToday ? `Played ${p.playedToday} today` : 'Nothing logged today'}
              >
                <Link
                  href={`/friends/${p.username}`}
                  className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                  aria-label={`Compare with ${p.username}`}
                >
                  <Swords aria-hidden /> Compare
                </Link>
              </Person>
            ))}
          </ul>
        ) : (
          <EmptyState title="No friends yet" className="py-6">
            Ask a friend for their player name and add them above.
          </EmptyState>
        )}
      </Card>

      {lists.outgoing.length ? (
        <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="outgoing-heading">
          <h2 id="outgoing-heading" className="text-xl">
            Waiting for them
          </h2>
          <ul className="divide-y-2 divide-line-soft" data-testid="outgoing">
            {lists.outgoing.map((p) => (
              <Person key={p.id} person={p}>
                <Action
                  path={`/api/friends/${p.id}`}
                  method="DELETE"
                  variant="ghost"
                  label={`Cancel request to ${p.username}`}
                >
                  Cancel
                </Action>
              </Person>
            ))}
          </ul>
        </Card>
      ) : null}

      {lists.blocked.length ? (
        <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="blocked-heading">
          <h2 id="blocked-heading" className="text-xl">
            Blocked
          </h2>
          <ul className="divide-y-2 divide-line-soft">
            {lists.blocked.map((p) => (
              <Person key={p.id} person={p}>
                <Action
                  path={`/api/friends/${p.id}`}
                  method="DELETE"
                  variant="ghost"
                  label={`Unblock ${p.username}`}
                >
                  Unblock
                </Action>
              </Person>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Person({
  person,
  note,
  children,
}: {
  person: { username: string; displayName: string | null };
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-display font-semibold">
          {person.displayName ?? person.username}
          {person.displayName ? (
            <span className="ml-1.5 font-body text-sm font-normal text-ink-soft">
              @{person.username}
            </span>
          ) : null}
        </p>
        {note ? <p className="text-sm text-ink-soft">{note}</p> : null}
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  );
}

function Action({
  path,
  method = 'POST',
  variant = 'secondary',
  label,
  done,
  children,
}: {
  path: string;
  method?: 'POST' | 'DELETE';
  variant?: 'secondary' | 'ghost';
  label: string;
  done?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={variant}
      loading={busy}
      aria-label={label}
      onClick={async () => {
        setBusy(true);
        try {
          await api(path, {}, method);
          if (done) toast({ tone: 'success', title: done });
          router.refresh();
        } catch (err) {
          toast({ tone: 'error', title: errorText(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </Button>
  );
}

function AddFriend({ me }: { me: string }) {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ status: 'pending' | 'accepted'; username: string }>('/api/friends', {
        username: username.replace(/^@/, ''),
      });
      toast({
        tone: 'success',
        title:
          r.status === 'accepted'
            ? `You and ${r.username} are friends`
            : `Request sent to ${r.username}`,
      });
      setUsername('');
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="add-heading">
      <h2 id="add-heading" className="flex items-center gap-2 text-xl">
        <UserPlus className="size-5 text-ink-soft" aria-hidden />
        Add a friend
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
        <Field
          label="Player name"
          hint={`Yours is ${me}. Share it so friends can add you.`}
          error={error ?? undefined}
          className="flex-1"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={username}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Button type="submit" loading={busy} disabled={!username.trim()} className="sm:mt-7">
          Send request
        </Button>
      </form>
    </Card>
  );
}

export function BlockButton({ userId, username }: { userId: string; username: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Ban aria-hidden /> Block
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Block ${username}?`}
        description="You'll stop being friends, and they won't be able to find or add you. You can unblock them later from Friends."
      >
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
                await api(`/api/friends/${userId}/block`, {});
                router.push('/friends');
                router.refresh();
              } catch (err) {
                toast({ tone: 'error', title: errorText(err) });
                setBusy(false);
              }
            }}
          >
            Block
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
