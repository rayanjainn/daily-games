'use client';

import { UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

/** A community's moderators. Only site moderators can add or remove them (`canEdit`). */
export function ModeratorManager({
  slug,
  moderators,
  canEdit,
}: {
  slug: string;
  moderators: { userId: string; username: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = (err: unknown) =>
    toast({ tone: 'error', title: err instanceof ApiError ? err.message : 'Could not save.' });
  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/admin/communities/${slug}/moderators`, { username });
      setUsername('');
      toast({ tone: 'success', title: 'Moderator added' });
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      {moderators.length ? (
        <ul className="divide-y-2 divide-line-soft" data-testid="board-moderators">
          {moderators.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="font-semibold">{m.username}</span>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${m.username} as moderator`}
                  onClick={async () => {
                    try {
                      await api(
                        `/api/admin/communities/${slug}/moderators/${m.userId}`,
                        {},
                        'DELETE',
                      );
                      router.refresh();
                    } catch (err) {
                      fail(err);
                    }
                  }}
                >
                  <UserMinus aria-hidden /> Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">
          No board moderators yet. Site moderators look after every board.
        </p>
      )}
      {canEdit ? (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <Field label="Player name" className="w-56">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={username}
                maxLength={20}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoComplete="off"
              />
            )}
          </Field>
          <Button type="submit" size="sm" loading={busy} disabled={!username.trim()}>
            Add moderator
          </Button>
        </form>
      ) : null}
    </div>
  );
}
