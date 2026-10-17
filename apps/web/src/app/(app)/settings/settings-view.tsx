'use client';

import {
  Check,
  Copy,
  Download,
  KeyRound,
  Laptop,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Usb,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { Notice } from '@/components/auth/auth-shell';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { addPasskey } from '@/lib/passkeys';

interface Passkey {
  id: string;
  nickname: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}
interface SessionRow {
  id: string;
  method: string;
  device: string;
  lastSeenAt: string;
  current: boolean;
}
interface Props {
  user: { username: string; displayName: string | null; timezone: string; email: string | null };
  passkeys: Passkey[];
  sessions: SessionRow[];
  recovery: { exists: boolean; confirmed: boolean; createdAt: string | null };
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'never';
const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

function Section({
  id,
  title,
  description,
  children,
  action,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={id} className="text-xl">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </Card>
    </section>
  );
}

export function SettingsView({ user, passkeys, sessions, recovery }: Props) {
  const atRisk = !user.email && (passkeys.length <= 1 || !recovery.confirmed);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl">Settings</h1>
          <p className="mt-1 text-ink-soft">
            Signed in as <strong className="text-ink">{user.username}</strong>
          </p>
        </div>
        <SignOutButton size="sm" />
      </div>
      {atRisk ? (
        <Notice tone="warn">
          <span className="flex gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              If you lose {passkeys.length <= 1 ? 'your only passkey' : 'your passkeys'} and your
              recovery phrase, and have no email on the account, nobody can get you back in. Add a
              second passkey and keep your phrase somewhere safe.
            </span>
          </span>
        </Notice>
      ) : null}
      <ProfileSection user={user} />
      <PasskeysSection passkeys={passkeys} />
      <RecoverySection recovery={recovery} />
      <SessionsSection sessions={sessions} />
      <DataSection username={user.username} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProfileSection({ user }: { user: Props['user'] }) {
  const router = useRouter();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [timezone, setTimezone] = useState(user.timezone);
  const [busy, setBusy] = useState(false);
  const detected =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
  // Browsers list ICU's canonical names (e.g. Asia/Calcutta), which may differ from the stored
  // IANA name (Asia/Kolkata). Always include the saved and detected zones so the select never
  // silently falls back to another zone.
  const zones = useMemo(() => {
    const all =
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set([user.timezone, ...(detected ? [detected] : []), ...all])].sort();
  }, [user.timezone, detected]);

  return (
    <Section
      id="profile"
      title="Profile"
      description="Your timezone decides when “today” starts for games that reset at local midnight."
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/api/me/profile', { displayName, timezone }, 'PATCH');
            toast({ tone: 'success', title: 'Profile saved' });
            router.refresh();
          } catch (err) {
            toast({ tone: 'error', title: "Couldn't save", body: errorText(err) });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Display name" hint="Optional. Shown next to your player name.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={displayName}
              maxLength={40}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field
          label="Timezone"
          hint={
            detected && detected !== timezone ? `This device is set to ${detected}.` : undefined
          }
        >
          {({ id, describedBy }) => (
            <select
              id={id}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-describedby={describedBy}
              className="h-12 w-full rounded-md border-[length:var(--bw)] border-line bg-surface px-3 text-md text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function passkeyKind(p: Passkey) {
  if (p.transports.includes('usb') || p.transports.includes('nfc') || p.transports.includes('ble'))
    return { label: 'Security key', icon: Usb };
  return { label: p.backedUp ? 'Synced passkey' : 'This device only', icon: Laptop };
}

function PasskeysSection({ passkeys }: { passkeys: Passkey[] }) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  return (
    <Section
      id="passkeys"
      title="Passkeys"
      description="Each device or security key you can sign in with."
      action={
        <Button
          size="sm"
          variant="grape"
          loading={adding}
          onClick={async () => {
            setAdding(true);
            const res = await addPasskey();
            setAdding(false);
            if (res.ok) {
              toast({ tone: 'success', title: 'Passkey added' });
              router.refresh();
            } else toast({ tone: 'error', title: "Couldn't add passkey", body: res.message });
          }}
        >
          <Plus aria-hidden /> Add passkey
        </Button>
      }
    >
      <ul className="flex flex-col gap-2.5" aria-label="Your passkeys">
        {passkeys.map((p) => {
          const kind = passkeyKind(p);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-line-soft bg-surface-2/60 p-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-md border-2 border-line bg-surface">
                <kind.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold">{p.nickname}</p>
                <p className="text-sm text-ink-soft">
                  {kind.label} · added {fmt(p.createdAt)} · last used {fmt(p.lastUsedAt)}
                </p>
              </div>
              <div className="flex gap-1.5">
                <RenamePasskey passkey={p} />
                <RemovePasskey passkey={p} />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function RenamePasskey({ passkey }: { passkey: Passkey }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(passkey.nickname);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="secondary" aria-label={`Rename ${passkey.nickname}`}>
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent title="Rename passkey">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(`/api/me/passkeys/${passkey.id}`, { nickname: name }, 'PATCH');
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          <Field label="Name" error={error ?? undefined}>
            {({ id, invalid }) => (
              <Input
                id={id}
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={invalid}
                autoFocus
              />
            )}
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="submit">Save</Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemovePasskey({ passkey }: { passkey: Passkey }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function remove(confirmLast: boolean) {
    setBusy(true);
    try {
      await api(`/api/me/passkeys/${passkey.id}`, { confirmLast }, 'DELETE');
      setOpen(false);
      toast({ tone: 'success', title: 'Passkey removed' });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'confirm_last') setNeedsConfirm(err.message);
      else toast({ tone: 'error', title: "Couldn't remove passkey", body: errorText(err) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setNeedsConfirm(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="secondary" aria-label={`Remove ${passkey.nickname}`}>
          <Trash2 aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Remove “${passkey.nickname}”?`}
        description="You won't be able to sign in with it any more. The passkey may still appear on the device until you delete it there too."
      >
        {needsConfirm ? <Notice tone="warn">{needsConfirm}</Notice> : null}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant="danger"
            loading={busy}
            onClick={() => void remove(Boolean(needsConfirm))}
          >
            {needsConfirm ? 'Remove anyway' : 'Remove'}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">Keep it</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function RecoverySection({ recovery }: { recovery: Props['recovery'] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [indices, setIndices] = useState<number[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '']);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setPhrase(null);
    setAnswers(['', '']);
    setError(null);
    setDone(false);
  }

  return (
    <Section
      id="recovery"
      title="Recovery phrase"
      description={
        recovery.exists
          ? `Created ${fmt(recovery.createdAt)}. Your way back in if you lose every passkey.`
          : 'You have no recovery phrase.'
      }
      action={
        recovery.confirmed ? (
          <Badge tone="success">Saved and checked</Badge>
        ) : (
          <Badge tone="warn">Not checked</Badge>
        )
      }
    >
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            if (phrase) router.refresh();
            reset();
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="secondary" className="self-start">
            <RefreshCw aria-hidden /> Make a new phrase
          </Button>
        </DialogTrigger>
        <DialogContent
          title={phrase ? 'Your new recovery phrase' : 'Make a new recovery phrase?'}
          description={
            phrase
              ? 'Shown once. Your old phrase no longer works.'
              : 'Your current phrase will stop working immediately.'
          }
        >
          {!phrase ? (
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await api<{ recoveryPhrase: string[]; confirm: number[] }>(
                      '/api/me/recovery/regenerate',
                      {},
                    );
                    setPhrase(res.recoveryPhrase);
                    setIndices(res.confirm);
                  } catch (err) {
                    setError(errorText(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Make a new phrase
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              {error ? <Notice tone="danger">{error}</Notice> : null}
            </div>
          ) : done ? (
            <div className="flex flex-col gap-3">
              <Notice tone="info">All set. Keep the new phrase safe.</Notice>
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('/api/auth/recovery/confirm', {
                    answers: indices.map((index, k) => ({ index, word: answers[k] ?? '' })),
                  });
                  setDone(true);
                } catch (err) {
                  setError(errorText(err));
                }
              }}
            >
              <ol
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                data-testid="new-recovery-phrase"
              >
                {phrase.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-md border-2 border-line bg-surface-2 px-3 py-2"
                  >
                    <span className="font-display text-xs font-bold text-ink-soft">{i + 1}</span>
                    <span className="font-display font-semibold" data-word>
                      {w}
                    </span>
                  </li>
                ))}
              </ol>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(phrase.join(' '));
                  setCopied(true);
                }}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}{' '}
                {copied ? 'Copied' : 'Copy words'}
              </Button>
              <p className="text-sm text-ink-soft">To finish, type these two words:</p>
              <div className="grid grid-cols-2 gap-3">
                {indices.map((index, k) => (
                  <Field key={index} label={`Word #${index + 1}`}>
                    {({ id }) => (
                      <Input
                        id={id}
                        value={answers[k]}
                        onChange={(e) =>
                          setAnswers((a) => a.map((x, j) => (j === k ? e.target.value : x)))
                        }
                        autoComplete="off"
                        autoCapitalize="none"
                        required
                      />
                    )}
                  </Field>
                ))}
              </div>
              {error ? <Notice tone="danger">{error}</Notice> : null}
              <Button type="submit">Check and save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const METHOD: Record<string, string> = {
  passkey: 'Passkey',
  signup: 'Sign-up',
  recovery: 'Recovery phrase',
  pairing: 'Device pairing',
  email: 'Email link',
};

function SessionsSection({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const others = sessions.filter((s) => !s.current).length;
  return (
    <Section
      id="sessions"
      title="Where you're signed in"
      action={
        others > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                const { revoked } = await api<{ revoked: number }>(
                  '/api/me/sessions/revoke-others',
                  {},
                );
                toast({
                  tone: 'success',
                  title: `Signed out of ${revoked} other ${revoked === 1 ? 'session' : 'sessions'}`,
                });
                router.refresh();
              } catch (err) {
                toast({ tone: 'error', title: 'Something went wrong', body: errorText(err) });
              }
            }}
          >
            Sign out everywhere else
          </Button>
        ) : null
      }
    >
      <ul className="flex flex-col gap-2.5" aria-label="Active sessions">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-line-soft bg-surface-2/60 p-3"
          >
            <KeyRound className="size-5 shrink-0 text-ink-soft" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold">
                {s.device} {s.current ? <Badge tone="mint">This device</Badge> : null}
              </p>
              <p className="text-sm text-ink-soft">
                {METHOD[s.method] ?? s.method} · active {fmt(s.lastSeenAt)}
              </p>
            </div>
            {!s.current ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await api(`/api/me/sessions/${s.id}`, {}, 'DELETE');
                    router.refresh();
                  } catch (err) {
                    toast({
                      tone: 'error',
                      title: "Couldn't sign out that session",
                      body: errorText(err),
                    });
                  }
                }}
              >
                Sign out
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function DataSection({ username }: { username: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Section
      id="data"
      title="Your data"
      description="Download everything we store about you, or delete your account."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="secondary">
          <a href="/api/me/export" download>
            <Download aria-hidden /> Download my data
          </a>
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger">
              <Trash2 aria-hidden /> Delete account
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Delete your account?"
            description="Your passkeys and recovery phrase stop working right away. Your results are erased for good after 7 days."
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api('/api/me/delete', { confirmUsername: confirm });
                  router.replace('/');
                  router.refresh();
                } catch (err) {
                  setError(errorText(err));
                  setBusy(false);
                }
              }}
            >
              <Field label={`Type ${username} to confirm`} error={error ?? undefined}>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    aria-invalid={invalid}
                  />
                )}
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  type="submit"
                  variant="danger"
                  loading={busy}
                  disabled={confirm.trim().toLowerCase() !== username}
                >
                  Delete forever
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Keep my account
                  </Button>
                </DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Section>
  );
}
