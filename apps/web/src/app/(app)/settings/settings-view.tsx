'use client';

import { Download, KeyRound, Laptop, Pencil, Plus, ShieldAlert, Trash2, Usb } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { AppearanceSection } from '@/components/theme/appearance-section';
import { ExtensionSection, type CaptureTokenRow } from '@/components/extension/extension-section';
import { Notice } from '@/components/auth/auth-shell';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { InstallApp } from '@/components/pwa/install-app';
import { EmailSettings, type EmailSettingsProps } from '@/components/reminders/email-settings';
import {
  ReminderSettings,
  type ReminderSettingsProps,
} from '@/components/reminders/reminder-settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
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
  user: {
    username: string;
    displayName: string | null;
    timezone: string;
    email: string | null;
    spoilerSafe: boolean;
    showOnRankings: boolean;
    prefs: { sound?: boolean; haptics?: boolean; reducedMotion?: boolean };
  };
  passkeys: Passkey[];
  sessions: SessionRow[];
  password: { set: boolean; setAt: string | null };
  reminders: ReminderSettingsProps;
  email: EmailSettingsProps;
  extension: { appUrl: string; tokens: CaptureTokenRow[] };
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

export function SettingsView({
  user,
  passkeys,
  sessions,
  password,
  reminders,
  email,
  extension,
}: Props) {
  const atRisk = !user.email && !password.set && passkeys.length <= 1;
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
              Your only way in is {passkeys.length ? 'one passkey' : 'nothing yet'}. If you lose
              that device, nobody can get you back in. Add a password, a second passkey or an email.
            </span>
          </span>
        </Notice>
      ) : null}
      <ProfileSection user={user} />
      <AppearanceSection prefs={user.prefs} />
      <InstallApp />
      <ReminderSettings {...reminders} />
      <EmailSettings {...email} />
      <PasskeysSection passkeys={passkeys} />
      <PasswordSection password={password} />
      <SessionsSection sessions={sessions} />
      <ExtensionSection {...extension} />
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
            <Select
              id={id}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-describedby={describedBy}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
      <SpoilerSafe initial={user.spoilerSafe} />
      <ShowOnRankings initial={user.showOnRankings} />
    </Section>
  );
}

/** Saved straight away, separate from the profile form. */
function SpoilerSafe({ initial }: { initial: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  return (
    <div className="flex items-center justify-between gap-3 border-t-2 border-line-soft pt-4">
      <label htmlFor="spoiler-safe" className="font-display text-sm font-semibold">
        Spoiler-safe
        <span className="block font-body text-xs font-normal text-ink-soft">
          Hide friends&apos; and groups&apos; results for a puzzle until you&apos;ve logged yours.
        </span>
      </label>
      <Switch
        id="spoiler-safe"
        checked={on}
        onCheckedChange={async (v) => {
          try {
            await api('/api/me/profile', { spoilerSafe: v }, 'PATCH');
            setOn(v);
          } catch (err) {
            toast({ tone: 'error', title: "Couldn't save", body: errorText(err) });
          }
        }}
      />
    </div>
  );
}

/** Saved straight away, like the spoiler switch. */
function ShowOnRankings({ initial }: { initial: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  return (
    <div className="flex items-center justify-between gap-3 border-t-2 border-line-soft pt-4">
      <label htmlFor="show-on-rankings" className="font-display text-sm font-semibold">
        Show me on global boards
        <span className="block font-body text-xs font-normal text-ink-soft">
          Your name appears on the daily boards of EveryDaily&apos;s own games. You always see your
          own result.
        </span>
      </label>
      <Switch
        id="show-on-rankings"
        checked={on}
        onCheckedChange={async (v) => {
          try {
            await api('/api/me/profile', { showOnRankings: v }, 'PATCH');
            setOn(v);
          } catch (err) {
            toast({ tone: 'error', title: "Couldn't save", body: errorText(err) });
          }
        }}
      />
    </div>
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

function PasswordSection({ password }: { password: Props['password'] }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<'set' | 'remove' | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode(null);
    setCurrent('');
    setNext('');
    setAgain('');
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'remove') await api('/api/me/password', { current }, 'DELETE');
      else
        await api(
          '/api/me/password',
          password.set ? { password: next, current } : { password: next },
          'PUT',
        );
      toast({
        tone: 'success',
        title:
          mode === 'remove'
            ? 'Password removed'
            : password.set
              ? 'Password changed'
              : 'Password saved',
      });
      reset();
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="password"
      title="Password"
      description={
        password.set
          ? `Set ${fmt(password.setAt)}. Use it with your player name on a device without your passkey.`
          : 'No password. Add one to sign in on a device that doesn\u2019t have your passkey.'
      }
      action={<Badge tone={password.set ? 'mint' : 'neutral'}>{password.set ? 'On' : 'Off'}</Badge>}
    >
      {mode ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {password.set ? (
            <Field label="Current password">
              {({ id }) => (
                <Input
                  id={id}
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              )}
            </Field>
          ) : null}
          {mode === 'set' ? (
            <>
              <Field label="New password" hint="At least 10 characters.">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="password"
                    value={next}
                    aria-describedby={describedBy}
                    onChange={(e) => setNext(e.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                  />
                )}
              </Field>
              <Field
                label="Type it again"
                error={again && again !== next ? "The passwords don't match." : undefined}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    type="password"
                    value={again}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    onChange={(e) => setAgain(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                )}
              </Field>
            </>
          ) : null}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              loading={busy}
              variant={mode === 'remove' ? 'danger' : 'primary'}
              disabled={mode === 'set' && (next.length < 10 || next !== again)}
            >
              {mode === 'remove' ? 'Remove password' : 'Save password'}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setMode('set')}>
            {password.set ? 'Change password' : 'Add a password'}
          </Button>
          {password.set ? (
            <Button variant="ghost" onClick={() => setMode('remove')}>
              Remove
            </Button>
          ) : null}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

const METHOD: Record<string, string> = {
  passkey: 'Passkey',
  signup: 'Sign-up',
  recovery: 'Recovery phrase',
  password: 'Password',
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
            description="Your passkeys and password stop working right away. Your results are erased for good after 7 days."
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
