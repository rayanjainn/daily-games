'use client';

import { ChevronRight, Crown, Plus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import type { GroupSummary } from '@/server/groups';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

/** Pulls the code out of a pasted invite link, or takes the code as typed. */
export function inviteCodeFrom(input: string): string {
  const s = input.trim();
  const m = /\/groups\/join\/([a-z0-9]+)/i.exec(s);
  return (m ? m[1]! : s).toLowerCase();
}

export function GroupsView({ groups }: { groups: GroupSummary[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl sm:text-4xl">Groups</h1>
        <p className="mt-1 text-ink-soft">
          A private leaderboard for your friends, family or team. Join with an invite link.
        </p>
      </div>
      <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="my-groups-heading">
        <h2 id="my-groups-heading" className="text-xl">
          Your groups
        </h2>
        {groups.length ? (
          <ul className="divide-y-2 divide-line-soft" data-testid="groups">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex items-center justify-between gap-3 rounded-md py-3 hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate font-display text-lg font-semibold">
                      {g.role === 'owner' ? (
                        <Crown className="size-4 text-warn" aria-label="You own this group" />
                      ) : null}
                      {g.name}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {g.members} {g.members === 1 ? 'player' : 'players'}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-ink-soft" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No groups yet" className="py-6">
            Start one below and share the invite link, or paste a link you were sent.
          </EmptyState>
        )}
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <CreateGroup />
        <JoinGroup />
      </div>
    </div>
  );
}

function CreateGroup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const g = await api<{ id: string }>('/api/groups', { name });
      router.push(`/groups/${g.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }
  return (
    <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="create-heading">
      <h2 id="create-heading" className="flex items-center gap-2 text-xl">
        <Plus className="size-5 text-ink-soft" aria-hidden />
        Start a group
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Field label="Group name" error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder="Family puzzlers"
            />
          )}
        </Field>
        <Button type="submit" loading={busy} disabled={!name.trim()} className="self-start">
          Create group
        </Button>
      </form>
    </Card>
  );
}

function JoinGroup() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const g = await api<{ id: string }>('/api/groups/join', { code: inviteCodeFrom(value) });
      router.push(`/groups/${g.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }
  return (
    <Card asSection className="flex flex-col gap-3 p-5" aria-labelledby="join-heading">
      <h2 id="join-heading" className="flex items-center gap-2 text-xl">
        <UsersRound className="size-5 text-ink-soft" aria-hidden />
        Join a group
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Field label="Invite link or code" error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={value}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setValue(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="secondary"
          loading={busy}
          disabled={!value.trim()}
          className="self-start"
        >
          Join
        </Button>
      </form>
    </Card>
  );
}
