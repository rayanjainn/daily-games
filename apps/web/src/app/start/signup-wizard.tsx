'use client';

import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser';
import {
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Shuffle,
  TriangleAlert,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Notice, StepDots, StepHeading } from '@/components/auth/auth-shell';
import { confettiBurst } from '@/components/game/confetti';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useHydrated } from '@/lib/use-hydrated';
import { solvePow, type SolvedPow } from '@/lib/pow';
import { useDebounced } from '@/lib/use-debounced';
import { passkeyErrorMessage } from '@/lib/webauthn-errors';

type Availability =
  { available: true; username: string } | { available: false; reason: string; message: string };
const STEPS = ['Name', 'Sign-in', 'Done'];
const PASSWORD_MIN = 10;

export function SignupWizard({ initialSuggestion }: { initialSuggestion: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(initialSuggestion);
  const [method, setMethod] = useState<'passkey' | 'password' | null>(null);
  const powRef = useRef<Promise<SolvedPow> | null>(null);

  // The invisible proof of work starts as soon as the page opens; nobody has to wait for it.
  const startPow = useCallback(() => {
    powRef.current = solvePow();
    powRef.current.catch(() => {});
  }, []);
  useEffect(() => startPow(), [startPow]);
  const getPow = async () => {
    const p = powRef.current ?? solvePow();
    powRef.current = null;
    return p;
  };

  const finish = (to: string) => {
    confettiBurst();
    setTimeout(() => router.push(to), 600);
  };

  return (
    <>
      <StepDots total={STEPS.length} current={step} labels={STEPS} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {step === 0 && (
            <NameStep
              username={username}
              setUsername={setUsername}
              onNext={(name) => {
                setUsername(name);
                setStep(1);
              }}
            />
          )}
          {step === 1 && (
            <SignInStep
              username={username}
              getPow={getPow}
              onRetryPow={startPow}
              onNameTaken={() => setStep(0)}
              onDone={(m) => {
                setMethod(m);
                setStep(2);
              }}
            />
          )}
          {step === 2 && method && (
            <ExtraStep method={method} onDone={() => finish('/today?welcome=1')} />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------

function NameStep({
  username,
  setUsername,
  onNext,
}: {
  username: string;
  setUsername: (s: string) => void;
  onNext: (name: string) => void;
}) {
  const debounced = useDebounced(username, 350);
  const [state, setState] = useState<{ for: string; result: Availability } | null>(null);
  const [checking, setChecking] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const hydrated = useHydrated();

  useEffect(() => {
    let live = true;
    const name = debounced.trim();
    if (!name) {
      setState(null);
      return;
    }
    setChecking(true);
    api<Availability>('/api/auth/username/check', { username: name })
      .then((result) => live && setState({ for: name, result }))
      .catch(
        (err) =>
          live &&
          setState({
            for: name,
            result: {
              available: false,
              reason: 'error',
              message: err instanceof ApiError ? err.message : 'Could not check that name.',
            },
          }),
      )
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [debounced]);

  const current = state && state.for === username.trim() ? state.result : null;
  const pending = checking || debounced !== username || !current;

  return (
    <section>
      <StepHeading eyebrow="Step 1 of 2" title="Pick your player name">
        This is how friends find you. You can change how you sign in later.
      </StepHeading>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (current?.available) onNext(current.username);
        }}
      >
        <Field
          label="Player name"
          hint={
            current && !current.available
              ? undefined
              : '3–20 characters: lowercase letters, numbers, underscores.'
          }
          error={current && !current.available ? current.message : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <Input
                id={id}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="pr-12 font-display text-lg font-semibold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-live="polite">
                {pending ? (
                  <Loader2
                    className="size-5 animate-spin text-ink-faint"
                    role="img"
                    aria-label="Checking"
                  />
                ) : current?.available ? (
                  <span
                    className="grid size-7 place-items-center rounded-pill bg-mint text-on-mint"
                    role="img"
                    aria-label="Available"
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    className="grid size-7 place-items-center rounded-pill bg-danger text-on-danger"
                    role="img"
                    aria-label="Not available"
                  >
                    <X className="size-4" strokeWidth={3} />
                  </span>
                )}
              </span>
            </div>
          )}
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            loading={shuffling}
            onClick={async () => {
              setShuffling(true);
              try {
                const { username: s } = await api<{ username: string }>(
                  '/api/auth/username/suggest',
                );
                setUsername(s);
              } finally {
                setShuffling(false);
              }
            }}
          >
            <Shuffle aria-hidden /> Shuffle
          </Button>
          <Button
            type="submit"
            size="lg"
            className="sm:flex-1"
            disabled={!hydrated || !current?.available || pending}
          >
            That&apos;s me
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------

function PasswordFields({
  password,
  setPassword,
  confirm,
  setConfirm,
  autoComplete = 'new-password',
}: {
  password: string;
  setPassword: (s: string) => void;
  confirm: string;
  setConfirm: (s: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const short = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <Field
        label="Password"
        hint={`At least ${PASSWORD_MIN} characters. A few unrelated words make a strong one.`}
        error={short ? `Use at least ${PASSWORD_MIN} characters.` : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <Input
              id={id}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={autoComplete}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={128}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-ink-soft hover:bg-surface-2"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
        )}
      </Field>
      <Field label="Type it again" error={mismatch ? "The passwords don't match." : undefined}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete={autoComplete}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            maxLength={128}
          />
        )}
      </Field>
    </>
  );
}

function SignInStep({
  username,
  getPow,
  onRetryPow,
  onNameTaken,
  onDone,
}: {
  username: string;
  getPow: () => Promise<SolvedPow>;
  onRetryPow: () => void;
  onNameTaken: () => void;
  onDone: (method: 'passkey' | 'password') => void;
}) {
  const [busy, setBusy] = useState<'passkey' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function run(kind: 'passkey' | 'password', fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      onDone(kind);
    } catch (err) {
      onRetryPow();
      if (err instanceof ApiError && err.code.startsWith('username_')) return onNameTaken();
      setError(err instanceof ApiError ? err.message : passkeyErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const withPasskey = () =>
    run('passkey', async () => {
      const { options } = await api<{ options: PublicKeyCredentialCreationOptionsJSON }>(
        '/api/auth/signup/options',
        { username, pow: await getPow() },
      );
      const response = await startRegistration({ optionsJSON: options });
      await api('/api/auth/signup/verify', { response, timezone: timezone() });
    });

  const withPassword = () =>
    run('password', async () => {
      await api('/api/auth/signup/password', {
        username,
        password,
        pow: await getPow(),
        timezone: timezone(),
      });
    });

  return (
    <section>
      <StepHeading eyebrow="Step 2 of 2" title="How do you want to sign in?">
        You&apos;re signing up as <strong className="text-ink">{username}</strong>.
      </StepHeading>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border-[length:var(--bw)] border-line bg-grape text-on-grape shadow-lift-sm">
            <Fingerprint className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-ink-soft">
            A <strong className="text-ink">passkey</strong> is the quickest and safest: Face ID,
            fingerprint or your device PIN, nothing to remember and nothing to steal. We never see
            your biometrics.
          </p>
        </div>
        {error ? (
          <Notice tone="danger">
            <span className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </span>
          </Notice>
        ) : null}
        <Button
          size="lg"
          onClick={withPasskey}
          loading={busy === 'passkey'}
          disabled={busy !== null}
          block
        >
          <KeyRound aria-hidden /> Create passkey
        </Button>
        <div className="flex items-center gap-3 text-sm text-ink-soft" aria-hidden>
          <span className="h-px flex-1 bg-line-soft" /> or{' '}
          <span className="h-px flex-1 bg-line-soft" />
        </div>
        {usePassword ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void withPassword();
            }}
          >
            <PasswordFields
              password={password}
              setPassword={setPassword}
              confirm={confirm}
              setConfirm={setConfirm}
            />
            <Button
              type="submit"
              variant="secondary"
              loading={busy === 'password'}
              disabled={busy !== null || password.length < PASSWORD_MIN || confirm !== password}
            >
              Create account with password
            </Button>
          </form>
        ) : (
          <Button variant="ghost" onClick={() => setUsePassword(true)}>
            Use a password instead
          </Button>
        )}
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * After a passkey: offer a password for signing in on a device that doesn't have the passkey.
 * After a password: offer a passkey for this device. Both can be skipped.
 */
function ExtraStep({ method, onDone }: { method: 'passkey' | 'password'; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (method === 'password')
    return (
      <section>
        <StepHeading title="You're in! One more thing?">
          Add a passkey on this device and next time you won&apos;t need the password here.
        </StepHeading>
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button
            size="lg"
            block
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const { addPasskey } = await import('@/lib/passkeys');
              const res = await addPasskey();
              setBusy(false);
              if (res.ok) onDone();
              else setError(res.message);
            }}
          >
            <Fingerprint aria-hidden /> Add a passkey
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Not now
          </Button>
        </Card>
      </section>
    );

  return (
    <section>
      <StepHeading title="You're in! Signing in elsewhere?">
        A password lets you sign in on a device that doesn&apos;t have your passkey, like a work
        computer. You can add a passkey there afterwards. Optional.
      </StepHeading>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api('/api/me/password', { password }, 'PUT');
            onDone();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not save that password.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirm={confirm}
            setConfirm={setConfirm}
          />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button
            type="submit"
            size="lg"
            block
            loading={busy}
            disabled={password.length < PASSWORD_MIN || confirm !== password}
          >
            Save password
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Skip, passkey only
          </Button>
        </Card>
      </form>
    </section>
  );
}
