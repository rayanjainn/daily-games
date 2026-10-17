'use client';

import { MailCheck, MailQuestion } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Notice } from '@/components/auth/auth-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';

export interface EmailSettingsProps {
  email: string | null;
  verified: boolean;
  /** A confirmation link was sent and is still valid. */
  pending: boolean;
  /** The server can send email. */
  enabled: boolean;
}

/**
 * Optional email: add an address, confirm it from the emailed link, change or remove it. Only a
 * confirmed address gets anything else (reminders).
 */
export function EmailSettings({ email, verified, pending, enabled }: EmailSettingsProps) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(!email);
  const [value, setValue] = useState(email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/me/email', { email: value });
      toast({ tone: 'success', title: 'Check your inbox for the confirmation link' });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api('/api/me/email', {}, 'DELETE');
      setValue('');
      setEditing(true);
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: err instanceof ApiError ? err.message : 'Could not remove.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="email-heading">
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 id="email-heading" className="text-xl">
            Email
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Optional. Used only for reminders you turn on. We never share it.
          </p>
        </div>
        {!enabled ? (
          <Notice tone="warn">Email isn&apos;t set up on this server yet.</Notice>
        ) : editing ? (
          <form onSubmit={send} className="flex flex-col gap-3" noValidate>
            <Field label="Email address" error={error ?? undefined}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                Send confirmation link
              </Button>
              {email ? (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3" data-testid="email-status">
            <p className="flex flex-wrap items-center gap-2">
              {verified ? (
                <MailCheck className="size-5 text-success" aria-hidden />
              ) : (
                <MailQuestion className="size-5 text-warn" aria-hidden />
              )}
              <span className="break-all font-semibold">{email}</span>
              <Badge tone={verified ? 'success' : 'warn'}>
                {verified ? 'Confirmed' : 'Not confirmed'}
              </Badge>
            </p>
            {!verified ? (
              <p className="text-sm text-ink-soft">
                {pending
                  ? 'We sent a link to this address. Open it to confirm.'
                  : 'The confirmation link has expired.'}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {!verified ? (
                <Button size="sm" variant="secondary" onClick={() => send()} loading={busy}>
                  Send a new link
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Change
              </Button>
              <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
                Remove
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
