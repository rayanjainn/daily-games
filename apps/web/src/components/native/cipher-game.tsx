'use client';

import { Eraser, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CIPHER_SLOTS } from '@everydaily/shared/native';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { CipherView } from '@/server/native';
import { ResultCard } from './result-card';
import { useNative } from './use-native';

/** Six symbols: a colour AND a shape, so no one needs to tell colours apart. */
const SYMBOLS = [
  { name: 'Orange circle', tone: 'bg-pop text-on-pop', shape: <circle cx="12" cy="12" r="7" /> },
  {
    name: 'Blue square',
    tone: 'bg-sky text-on-sky',
    shape: <rect x="5" y="5" width="14" height="14" rx="2" />,
  },
  { name: 'Green triangle', tone: 'bg-mint text-on-mint', shape: <path d="M12 4 21 20H3z" /> },
  {
    name: 'Yellow diamond',
    tone: 'bg-sun text-on-sun',
    shape: <path d="M12 3 21 12 12 21 3 12z" />,
  },
  {
    name: 'Purple star',
    tone: 'bg-grape text-on-grape',
    shape: <path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z" />,
  },
  {
    name: 'Pink cross',
    tone: 'bg-bubblegum text-on-bubblegum',
    shape: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  },
] as const;

function Symbol({ index, className }: { index: number; className?: string }) {
  const s = SYMBOLS[index]!;
  return (
    <span
      className={cn(
        'grid size-11 place-items-center rounded-md border-[length:var(--bw)] border-line',
        s.tone,
        className,
      )}
      role="img"
      aria-label={s.name}
    >
      <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden>
        {s.shape}
      </svg>
    </span>
  );
}

const feedbackText = (exact: number, misplaced: number) =>
  `${exact} in the right place, ${misplaced} in the wrong place`;

function Pegs({ exact, misplaced }: { exact: number; misplaced: number }) {
  const pegs = [
    ...Array<string>(exact).fill('bg-mint'),
    ...Array<string>(misplaced).fill('bg-sun'),
    ...Array<string>(CIPHER_SLOTS - exact - misplaced).fill('bg-surface-3'),
  ];
  return (
    <span className="grid grid-cols-2 gap-1" role="img" aria-label={feedbackText(exact, misplaced)}>
      {pegs.map((c, i) => (
        <span key={i} className={cn('size-3.5 rounded-full border-2 border-line', c)} />
      ))}
    </span>
  );
}

export function CipherGame({ initial }: { initial: CipherView }) {
  const { view, busy, error, send, setError } = useNative('cipher', initial);
  const [draft, setDraft] = useState<number[]>([]);

  const over = view.finished;
  const push = (n: number) => {
    if (over || busy) return;
    setError(null);
    setDraft((d) => (d.length < CIPHER_SLOTS ? [...d, n] : d));
  };
  async function check() {
    if (draft.length !== CIPHER_SLOTS || busy || over) return;
    if (await send({ action: 'guess', guess: draft })) setDraft([]);
  }

  // Keyboard: 1-6 add a symbol, Backspace removes one, Enter checks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '6') push(Number(e.key) - 1);
      else if (e.key === 'Backspace') setDraft((d) => d.slice(0, -1));
      else if (
        e.key === 'Enter' &&
        e.target instanceof HTMLElement &&
        e.target.tagName !== 'BUTTON'
      )
        void check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const rows = Array.from({ length: view.maxGuesses }, (_, i) => view.guesses[i] ?? null);
  const current = view.guesses.length;
  return (
    <div className="flex flex-col gap-5" data-testid="cipher">
      <p className="text-ink-soft">
        Crack the code: {CIPHER_SLOTS} symbols, any of the 6, repeats allowed. Green pegs mean right
        symbol in the right place; yellow, right symbol in the wrong place. Keys 1 to 6 pick a
        symbol.
      </p>
      <ol className="flex flex-col gap-2" aria-label="Your guesses" data-testid="cipher-rows">
        {rows.map((r, i) => (
          <li
            key={i}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border-[length:var(--bw)] p-2',
              r
                ? 'border-line bg-surface'
                : i === current && !over
                  ? 'border-line bg-surface-2'
                  : 'border-line-soft',
            )}
            aria-label={`Guess ${i + 1}`}
            data-testid="cipher-row"
          >
            <span className="flex gap-2">
              {Array.from({ length: CIPHER_SLOTS }, (_, k) => {
                const sym = r ? r.guess[k] : i === current && !over ? draft[k] : undefined;
                return sym !== undefined ? (
                  i === current && !r ? (
                    <button
                      key={k}
                      type="button"
                      className="rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
                      aria-label={`Remove ${SYMBOLS[sym]!.name}`}
                      onClick={() => setDraft((d) => d.filter((_, j) => j !== k))}
                    >
                      <Symbol index={sym} />
                    </button>
                  ) : (
                    <Symbol key={k} index={sym} />
                  )
                ) : (
                  <span
                    key={k}
                    className="size-11 rounded-md border-2 border-dashed border-line-soft"
                    aria-hidden
                  />
                );
              })}
            </span>
            {r ? <Pegs exact={r.exact} misplaced={r.misplaced} /> : <span className="w-8" />}
          </li>
        ))}
      </ol>

      {over ? (
        <>
          {view.code ? (
            <p className="flex flex-wrap items-center gap-2" data-testid="cipher-code">
              The code was
              {view.code.map((c, i) => (
                <Symbol key={i} index={c} className="size-9" />
              ))}
            </p>
          ) : null}
          {view.result ? (
            <ResultCard
              slug="cipher"
              heading={view.solved ? 'Cracked it!' : 'Not today'}
              summary={view.result.summary}
              shareText={view.result.shareText}
            />
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Symbols">
            {SYMBOLS.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => push(i)}
                disabled={busy || draft.length >= CIPHER_SLOTS}
                aria-label={`Add ${s.name}`}
                className="rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40 disabled:opacity-50"
              >
                <Symbol index={i} className="size-12" />
              </button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={check} loading={busy} disabled={draft.length !== CIPHER_SLOTS}>
              Check guess
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDraft((d) => d.slice(0, -1))}
              disabled={!draft.length}
            >
              <Undo2 aria-hidden /> Undo
            </Button>
            <Button variant="ghost" onClick={() => setDraft([])} disabled={!draft.length}>
              <Eraser aria-hidden /> Clear
            </Button>
          </div>
          <p className="text-sm text-ink-soft" aria-live="polite">
            Guess {Math.min(current + 1, view.maxGuesses)} of {view.maxGuesses}
          </p>
        </div>
      )}
    </div>
  );
}
