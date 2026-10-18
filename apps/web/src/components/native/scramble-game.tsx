'use client';

import { Check, Timer } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { ScrambleView } from '@/server/native';
import { ResultCard } from './result-card';
import { clock, useElapsed, useNative } from './use-native';

export function ScrambleGame({ initial }: { initial: ScrambleView }) {
  const { view, busy, error, send, setError } = useNative('scramble', initial);
  const seconds = useElapsed(view.startedAt, !view.finished);
  const [guesses, setGuesses] = useState<string[]>(view.scrambled.map(() => ''));
  const [at, setAt] = useState<number | null>(null);

  async function check(e: FormEvent, i: number) {
    e.preventDefault();
    const guess = guesses[i]!.trim();
    if (!guess || busy) return;
    setAt(i);
    if (await send({ action: 'word', index: i, guess }))
      setGuesses((g) => g.map((v, j) => (j === i ? '' : v)));
  }

  const found = view.solvedWords.filter(Boolean).length;
  return (
    <div className="flex flex-col gap-5" data-testid="scramble">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          Unscramble all five words. Any real word that uses exactly those letters counts.
        </p>
        <p
          className="flex items-center gap-1.5 font-display text-xl font-bold tabular-nums"
          data-testid="timer"
        >
          <Timer className="size-5 text-ink-soft" aria-hidden />
          <span aria-hidden>
            {clock(view.finished ? (view.result?.timeSeconds ?? seconds) : seconds)}
          </span>
          <span className="sr-only">
            {found} of {view.scrambled.length} words found
          </span>
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {view.scrambled.map((letters, i) => {
          const word = view.solvedWords[i];
          return (
            <li
              key={i}
              className={cn(
                'rounded-lg border-[length:var(--bw)] border-line p-3',
                word ? 'bg-success-soft' : 'bg-surface',
              )}
              data-testid="scramble-word"
              data-solved={word ? 'true' : 'false'}
            >
              <form onSubmit={(e) => check(e, i)} className="flex flex-wrap items-center gap-3">
                <span
                  className="flex gap-1.5 font-display text-2xl font-bold uppercase tracking-widest"
                  role="img"
                  aria-label={`Letters ${letters.split('').join(' ')}`}
                >
                  {letters.split('').map((c, k) => (
                    <span
                      key={k}
                      className="grid size-9 place-items-center rounded-md border-[length:var(--bw)] border-line bg-surface-2"
                      aria-hidden
                    >
                      {c}
                    </span>
                  ))}
                </span>
                {word ? (
                  <span className="flex items-center gap-1.5 font-display text-xl font-bold text-success">
                    <Check className="size-5" aria-hidden /> {word}
                  </span>
                ) : (
                  <>
                    <label className="sr-only" htmlFor={`word-${i}`}>
                      Word {i + 1}
                    </label>
                    <input
                      id={`word-${i}`}
                      value={guesses[i]}
                      onChange={(e) => {
                        setError(null);
                        setGuesses((g) => g.map((v, j) => (j === i ? e.target.value : v)));
                      }}
                      disabled={view.finished}
                      maxLength={12}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-11 w-40 rounded-md border-[length:var(--bw)] border-line bg-surface px-3 font-display text-lg font-semibold lowercase outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={busy && at === i}
                      disabled={!guesses[i]!.trim() || view.finished}
                    >
                      Check
                    </Button>
                  </>
                )}
              </form>
            </li>
          );
        })}
      </ol>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {view.finished && view.result ? (
        <ResultCard
          slug="scramble"
          heading="All five!"
          summary={view.result.summary}
          shareText={view.result.shareText}
        />
      ) : null}
    </div>
  );
}
