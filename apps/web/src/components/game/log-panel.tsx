'use client';

import { Check, ClipboardPaste, PartyPopper, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { ScoringType, Tier } from '@everydaily/shared/domain';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/lib/use-debounced';
import { confettiBurst } from './confetti';

export interface LoggableGame {
  slug: string;
  name: string;
  tier: Tier;
  scoringType: ScoringType;
  maxAttempts: number | null;
  scoringUnit: string | null;
}

interface Preview {
  puzzleNumber: number | null;
  puzzleDate: string;
  solved: boolean;
  summary: string;
  grid: string | null;
  duplicate: boolean;
}

interface Saved {
  id: string;
  summary: string;
  solved: boolean;
  streak: { current: number };
}

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** Logging an earlier puzzle from the archive tracker instead of today's. */
export interface ArchiveTarget {
  puzzleNumber: number;
  /** "#1,730 · Wed, Oct 15" or "Wed, Oct 15" */
  label: string;
}

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

/**
 * Logs a result for one game: paste the share text (preview first, then save), enter the score
 * by hand, or, for check-off games, mark the puzzle done.
 */
export function LogPanel({
  game,
  onLogged,
  archive,
  className,
}: {
  game: LoggableGame;
  onLogged?: (saved: Saved) => void;
  archive?: ArchiveTarget;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState<Saved | null>(null);

  function done(s: Saved) {
    setSaved(s);
    onLogged?.(s);
    if (s.solved) confettiBurst(undefined, 60);
    router.refresh();
  }

  async function undo() {
    if (!saved) return;
    try {
      await api(`/api/results/${saved.id}`, {}, 'DELETE');
      setSaved(null);
      toast({ tone: 'info', title: 'Result removed' });
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: errorText(err) });
    }
  }

  if (saved) {
    return (
      <div
        className={cn('flex flex-col items-center gap-3 py-4 text-center', className)}
        role="status"
        data-testid="log-success"
      >
        <span className="grid size-14 place-items-center rounded-full border-[length:var(--bw)] border-line bg-mint text-on-mint shadow-lift-sm">
          <PartyPopper className="size-7" aria-hidden />
        </span>
        <p className="font-display text-2xl font-bold">
          {archive ? 'Caught up' : 'Logged'}: {saved.summary}
        </p>
        <p className="text-sm text-ink-soft">
          {archive
            ? 'It counts in your stats. Streaks only count puzzles played on the day.'
            : saved.streak.current > 1
              ? `${saved.streak.current} days in a row. Keep it going!`
              : 'Your streak starts today.'}
        </p>
        <Button variant="ghost" size="sm" onClick={undo}>
          <Undo2 aria-hidden />
          Undo
        </Button>
      </div>
    );
  }

  if (game.tier === 3)
    return <CheckoffForm game={game} archive={archive} onDone={done} className={className} />;

  return (
    <Tabs defaultValue="paste" className={className}>
      <TabsList className="w-full">
        <TabsTrigger value="paste" className="flex-1">
          Paste result
        </TabsTrigger>
        <TabsTrigger value="manual" className="flex-1">
          Enter score
        </TabsTrigger>
      </TabsList>
      <TabsContent value="paste">
        <PasteForm game={game} archive={archive} onDone={done} />
      </TabsContent>
      <TabsContent value="manual">
        <ManualForm game={game} archive={archive} onDone={done} />
      </TabsContent>
    </Tabs>
  );
}

function CheckoffForm({
  game,
  archive,
  onDone,
  className,
}: {
  game: LoggableGame;
  archive?: ArchiveTarget;
  onDone: (s: Saved) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function mark() {
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api<Saved>(
          '/api/results',
          archive
            ? {
                source: 'checkbox',
                slug: game.slug,
                puzzleNumber: archive.puzzleNumber,
                fromArchive: true,
              }
            : { source: 'checkbox', slug: game.slug },
        ),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={cn('flex flex-col items-center gap-3 py-2 text-center', className)}>
      <p className="text-sm text-ink-soft">
        {game.name} doesn&apos;t share a score, so we track it with a check-off.
      </p>
      <Button size="lg" variant="mint" loading={busy} onClick={mark}>
        <Check aria-hidden />
        {archive ? `Mark ${archive.label} done` : 'Mark today done'}
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PasteForm({
  game,
  archive,
  onDone,
}: {
  game: LoggableGame;
  archive?: ArchiveTarget;
  onDone: (s: Saved) => void;
}) {
  const fromArchive = Boolean(archive);
  const extra = fromArchive ? { fromArchive } : {};
  const [text, setText] = useState('');
  const debounced = useDebounced(text.trim(), 250);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canReadClipboard, setCanReadClipboard] = useState(false);
  const previewId = useId();

  useEffect(() => {
    setCanReadClipboard(typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText));
  }, []);

  useEffect(() => {
    if (!debounced) {
      setPreview(null);
      setError(null);
      return;
    }
    let live = true;
    setChecking(true);
    api<Preview>('/api/results/preview', {
      source: 'paste',
      slug: game.slug,
      shareText: debounced,
      ...(fromArchive ? { fromArchive } : {}),
    })
      .then((p) => {
        if (!live) return;
        setPreview(p);
        setError(null);
      })
      .catch((err) => {
        if (!live) return;
        setPreview(null);
        setError(errorText(err));
      })
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [debounced, game.slug, fromArchive]);

  async function pasteFromClipboard() {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      setError('Your browser blocked clipboard access. Paste with your keyboard instead.');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!preview || preview.duplicate) return;
    setBusy(true);
    try {
      onDone(
        await api<Saved>('/api/results', {
          source: 'paste',
          slug: game.slug,
          shareText: text,
          ...extra,
        }),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const stale = text.trim() !== debounced || checking;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        label={`Your ${game.name} share text`}
        hint="Tap Share in the game, then paste it here."
        error={error ?? undefined}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-describedby={[describedBy, preview ? previewId : null].filter(Boolean).join(' ')}
            aria-invalid={invalid}
            maxLength={4096}
            spellCheck={false}
            autoComplete="off"
            className="min-h-44 font-mono text-sm leading-snug"
            placeholder={`${game.name} …`}
          />
        )}
      </Field>
      {canReadClipboard ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={pasteFromClipboard}
        >
          <ClipboardPaste aria-hidden />
          Paste from clipboard
        </Button>
      ) : null}
      {preview ? (
        <div
          id={previewId}
          data-testid="log-preview"
          className={cn(
            'flex items-start gap-3 rounded-lg border-2 p-3',
            preview.duplicate ? 'border-warn/40 bg-warn-soft' : 'border-line-soft bg-surface-2',
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{preview.summary}</p>
            <p className="text-sm text-ink-soft">
              {preview.puzzleNumber !== null
                ? `#${preview.puzzleNumber.toLocaleString('en-US')} · `
                : ''}
              {shortDate(preview.puzzleDate)}
            </p>
            {preview.duplicate ? (
              <p className="mt-1 text-sm font-semibold text-warn">
                You already logged this puzzle.
              </p>
            ) : null}
          </div>
          {preview.grid ? (
            <pre className="shrink-0 font-mono text-xs leading-tight" aria-hidden>
              {preview.grid}
            </pre>
          ) : null}
        </div>
      ) : null}
      <Button
        type="submit"
        loading={busy}
        disabled={!preview || preview.duplicate || stale}
        className="self-start"
      >
        Save result
      </Button>
    </form>
  );
}

const parseClock = (s: string): number | null => {
  const m = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*$/.exec(s) ?? /^\s*(\d+)\s*$/.exec(s);
  if (!m) return null;
  if (m.length === 2) return Number(m[1]);
  const [, h, mm, ss] = m;
  if (Number(ss) > 59) return null;
  return Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss);
};

function ManualForm({
  game,
  archive,
  onDone,
}: {
  game: LoggableGame;
  archive?: ArchiveTarget;
  onDone: (s: Saved) => void;
}) {
  const [solved, setSolved] = useState(true);
  const [attempts, setAttempts] = useState('');
  const [time, setTime] = useState('');
  const [score, setScore] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const max = game.maxAttempts ?? 10;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const entry: Record<string, unknown> = { solved };
    if (archive) entry.puzzleNumber = archive.puzzleNumber;
    if (game.scoringType === 'attempts') {
      if (!attempts) return setError('How many guesses did it take?');
      entry.attempts = Number(attempts);
    } else if (game.scoringType === 'time') {
      const secs = parseClock(time);
      if (secs === null) return setError('Enter a time like 1:23.');
      entry.timeSeconds = secs;
    } else if (game.scoringType === 'points' || game.scoringType === 'distance') {
      if (!/^-?\d+$/.test(score.trim())) return setError('Enter a whole number.');
      entry.score = Number(score.trim());
    }
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api<Saved>('/api/results', {
          source: 'manual',
          slug: game.slug,
          entry,
          ...(archive ? { fromArchive: true } : {}),
        }),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {game.scoringType === 'attempts' ? (
        <Field label="Guesses" error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              value={attempts}
              onChange={(e) => setAttempts(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            >
              <option value="">Choose</option>
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : game.scoringType === 'time' ? (
        <Field label="Time" hint="Minutes and seconds, like 1:23" error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={time}
              inputMode="numeric"
              placeholder="0:45"
              onChange={(e) => setTime(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      ) : (
        <Field
          label={game.scoringUnit ? `Score (${game.scoringUnit})` : 'Score'}
          error={error ?? undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={score}
              inputMode="numeric"
              onChange={(e) => setScore(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      )}
      <label className="flex items-center justify-between gap-3 rounded-md border-[length:var(--bw)] border-line-soft px-4 py-3">
        <span className="font-display text-sm font-semibold">I solved it</span>
        <Switch checked={solved} onCheckedChange={setSolved} aria-label="I solved it" />
      </label>
      <Button type="submit" loading={busy} className="self-start">
        Save result
      </Button>
    </form>
  );
}
