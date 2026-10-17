'use client';

import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/browser';
import {
  Check,
  Copy,
  Fingerprint,
  KeyRound,
  Loader2,
  Shuffle,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Notice, StepDots, StepHeading } from '@/components/auth/auth-shell';
import { PuzzleGate } from '@/components/auth/puzzle-gate';
import { confettiBurst } from '@/components/game/confetti';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useHydrated } from '@/lib/use-hydrated';
import { cn } from '@/lib/cn';
import { solvePow, type SolvedPow } from '@/lib/pow';
import { useDebounced } from '@/lib/use-debounced';
import { passkeyErrorMessage } from '@/lib/webauthn-errors';

type Availability =
  { available: true; username: string } | { available: false; reason: string; message: string };
const STEPS = ['Name', 'Warm-up', 'Passkey', 'Recovery', 'Check'];

export function SignupWizard({ initialSuggestion }: { initialSuggestion: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(initialSuggestion);
  const [gatePass, setGatePass] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number[]>([]);
  const powRef = useRef<Promise<SolvedPow> | null>(null);

  // Proof of work starts in the background as soon as the wizard opens.
  const startPow = useCallback(() => {
    powRef.current = solvePow();
    powRef.current.catch(() => {});
  }, []);
  useEffect(() => startPow(), [startPow]);

  return (
    <>
      <StepDots total={STEPS.length} current={step} labels={STEPS} />
      {step === 0 && (
        <NameStep
          username={username}
          setUsername={setUsername}
          onNext={(name) => {
            setUsername(name);
            setStep(gatePass ? 2 : 1);
          }}
        />
      )}
      {step === 1 && (
        <section>
          <StepHeading eyebrow="Step 2 of 5" title="Quick warm-up">
            Unscramble the word. Tap the tiles or just type.
          </StepHeading>
          <Card className="p-5 sm:p-6">
            <PuzzleGate
              onPass={(pass) => {
                setGatePass(pass);
                setStep(2);
              }}
            />
          </Card>
        </section>
      )}
      {step === 2 && gatePass && (
        <PasskeyStep
          username={username}
          gatePass={gatePass}
          getPow={async () => {
            const p = powRef.current ?? solvePow();
            powRef.current = null;
            return p;
          }}
          onRetryPow={startPow}
          onNameTaken={() => setStep(0)}
          onDone={(words, indices) => {
            setPhrase(words);
            setConfirmIdx(indices);
            setStep(3);
          }}
        />
      )}
      {step === 3 && phrase && <PhraseStep phrase={phrase} onNext={() => setStep(4)} />}
      {step === 4 && phrase && (
        <ConfirmStep
          indices={confirmIdx}
          onBack={() => setStep(3)}
          onDone={() => {
            confettiBurst();
            setTimeout(() => router.push('/today?welcome=1'), 700);
          }}
        />
      )}
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
      <StepHeading eyebrow="Step 1 of 5" title="Pick your player name">
        This is how friends will find you. No email, no password.
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

function PasskeyStep({
  username,
  gatePass,
  getPow,
  onRetryPow,
  onNameTaken,
  onDone,
}: {
  username: string;
  gatePass: string;
  getPow: () => Promise<SolvedPow>;
  onRetryPow: () => void;
  onNameTaken: () => void;
  onDone: (phrase: string[], confirm: number[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const pow = await getPow();
      const { options } = await api<{ options: PublicKeyCredentialCreationOptionsJSON }>(
        '/api/auth/signup/options',
        {
          username,
          gatePass,
          pow,
        },
      );
      const response = await startRegistration({ optionsJSON: options });
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api<{ recoveryPhrase: string[]; confirm: number[] }>(
        '/api/auth/signup/verify',
        { response, timezone },
      );
      onDone(res.recoveryPhrase, res.confirm);
    } catch (err) {
      onRetryPow();
      if (err instanceof ApiError) {
        if (err.code.startsWith('username_')) {
          onNameTaken();
          return;
        }
        setError(err.message);
      } else {
        setError(passkeyErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <StepHeading eyebrow="Step 3 of 5" title="Create your passkey">
        A passkey lets you sign in as <strong className="text-ink">{username}</strong> with your
        face, fingerprint or device PIN.
      </StepHeading>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border-[length:var(--bw)] border-line bg-grape text-on-grape shadow-lift-sm">
            <Fingerprint className="size-6" aria-hidden />
          </span>
          <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
            <li>
              Your device decides how to confirm it&apos;s you: Face ID, fingerprint, Windows Hello
              or your device PIN.
            </li>
            <li>We never see your biometrics. They stay on your device.</li>
            <li>Works on phones, laptops and security keys.</li>
          </ul>
        </div>
        {error ? (
          <Notice tone="danger">
            <span className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </span>
          </Notice>
        ) : null}
        <Button size="lg" onClick={create} loading={busy} block>
          <KeyRound aria-hidden /> Create passkey
        </Button>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------

function PhraseStep({ phrase, onNext }: { phrase: string[]; onNext: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <section>
      <StepHeading eyebrow="Step 4 of 5" title="Save your recovery phrase">
        If you ever lose every device with your passkey, these six words get you back in. We only
        show them once.
      </StepHeading>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid="recovery-phrase">
          {phrase.map((w, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border-[length:var(--bw)] border-line bg-surface-2 px-3 py-2.5"
            >
              <span className="font-display text-xs font-bold text-ink-soft tabular-nums">
                {i + 1}
              </span>
              <span className="font-display text-lg font-semibold" data-word>
                {w}
              </span>
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(phrase.join(' '));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? 'Copied' : 'Copy words'}
        </Button>
        <Notice tone="warn">
          Write them down or keep them in a password manager. Anyone with these words and your name
          can sign in as you. If you lose all your passkeys <em>and</em> this phrase, and
          haven&apos;t added an email, your account can&apos;t be recovered.
        </Notice>
        <label className="flex cursor-pointer items-start gap-3 rounded-md p-1">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-1 size-5 accent-[var(--grape)]"
          />
          <span className="font-display font-semibold">
            I saved my recovery phrase somewhere safe
          </span>
        </label>
        <Button size="lg" block disabled={!saved} onClick={onNext}>
          Continue
        </Button>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ConfirmStep({
  indices,
  onBack,
  onDone,
}: {
  indices: number[];
  onBack: () => void;
  onDone: () => void;
}) {
  const [words, setWords] = useState<string[]>(indices.map(() => ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const hydrated = useHydrated();
  return (
    <section>
      <StepHeading eyebrow="Step 5 of 5" title="Quick check">
        Type the words to make sure you saved them.
      </StepHeading>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api('/api/auth/recovery/confirm', {
              answers: indices.map((index, k) => ({ index, word: words[k] ?? '' })),
            });
            setDone(true);
            onDone();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not check those words.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Card className={cn('flex flex-col gap-4 p-5 sm:p-6', error && 'animate-shake')}>
          {indices.map((index, k) => (
            <Field key={index} label={`Word #${index + 1}`}>
              {({ id }) => (
                <Input
                  id={id}
                  value={words[k]}
                  onChange={(e) =>
                    setWords((ws) => ws.map((w, j) => (j === k ? e.target.value : w)))
                  }
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className="font-display text-lg"
                />
              )}
            </Field>
          ))}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button type="submit" size="lg" block loading={busy} disabled={!hydrated || done}>
            {done ? 'All set!' : 'Finish'}
          </Button>
        </Card>
        <Button type="button" variant="ghost" onClick={onBack}>
          Show my words again
        </Button>
      </form>
    </section>
  );
}
