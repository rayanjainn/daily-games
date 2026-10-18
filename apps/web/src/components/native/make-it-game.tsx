'use client';

import { Delete, Target, Timer } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { MakeItView } from '@/server/native';
import { ResultCard } from './result-card';
import { clock, useElapsed, useNative } from './use-native';

const OPS = ['+', '−', '×', '÷', '(', ')'] as const;

export function MakeItGame({ initial }: { initial: MakeItView }) {
  const { view, busy, error, send, setError } = useNative('make-it', initial);
  const seconds = useElapsed(view.startedAt, !view.finished);
  const [expression, setExpression] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // How many times each given number appears in what has been typed so far.
  const typed = expression.match(/\d+/g)?.map(Number) ?? [];
  const left = [...view.numbers];
  for (const n of typed) {
    const k = left.indexOf(n);
    if (k >= 0) left.splice(k, 1);
  }

  const add = (s: string) => {
    setError(null);
    setExpression((e) => e + s);
    input.current?.focus();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!expression.trim() || busy || view.finished) return;
    await send({ action: 'expression', expression });
  }

  return (
    <div className="flex flex-col gap-5" data-testid="make-it">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          Use all four numbers exactly once, with + − × ÷ and brackets, to make the target.
        </p>
        <p
          className="flex items-center gap-1.5 font-display text-xl font-bold tabular-nums"
          data-testid="timer"
        >
          <Timer className="size-5 text-ink-soft" aria-hidden />
          <span aria-hidden>
            {clock(view.finished ? (view.result?.timeSeconds ?? seconds) : seconds)}
          </span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-1 rounded-lg border-[length:var(--bw)] border-line bg-surface-2 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          <Target className="size-4" aria-hidden /> Target
        </p>
        <p className="font-display text-6xl font-bold leading-none" data-testid="target">
          {view.target}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Your numbers">
        {view.numbers.map((n, i) => {
          // A tile greys out once the typed expression has used that copy of the number.
          const same = view.numbers.filter((m) => m === n).length;
          const usedCopies = same - left.filter((m) => m === n).length;
          const rank = view.numbers.slice(0, i + 1).filter((m) => m === n).length;
          const used = rank <= usedCopies;
          return (
            <button
              key={i}
              type="button"
              onClick={() => add(String(n))}
              disabled={view.finished}
              className={cn(
                'grid size-16 place-items-center rounded-lg border-[length:var(--bw)] border-line font-display text-3xl font-bold shadow-lift-sm transition-opacity focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40',
                used ? 'bg-surface-3 opacity-60' : 'bg-sun text-on-sun',
              )}
              aria-label={`Add ${n}${used ? ' (already used)' : ''}`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {view.finished ? (
        <>
          {view.expression ? (
            <p className="text-center text-sm text-ink-soft">
              Your answer: <span className="font-semibold text-ink">{view.expression}</span> ={' '}
              {view.target}
            </p>
          ) : null}
          {view.result ? (
            <ResultCard
              slug="make-it"
              heading="Made it!"
              summary={view.result.summary}
              shareText={view.result.shareText}
            />
          ) : null}
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Operators">
            {OPS.map((op) => (
              <Button
                key={op}
                type="button"
                variant="secondary"
                size="icon"
                className="size-11 text-xl"
                onClick={() => add(op)}
                aria-label={`Add ${op}`}
              >
                {op}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Delete the last character"
              onClick={() => setExpression((e) => e.slice(0, -1))}
              disabled={!expression}
            >
              <Delete aria-hidden />
            </Button>
          </div>
          <label className="sr-only" htmlFor="expression">
            Your expression
          </label>
          <input
            id="expression"
            ref={input}
            value={expression}
            onChange={(e) => {
              setError(null);
              setExpression(e.target.value);
            }}
            maxLength={80}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. (8 − 6) × 4 × 3"
            className="h-12 rounded-md border-[length:var(--bw)] border-line bg-surface px-3 font-display text-xl font-semibold outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'expression-error' : undefined}
          />
          {error ? (
            <p id="expression-error" role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={busy} disabled={!expression.trim()}>
              Check
            </Button>
            {view.tries > 0 ? (
              <span className="text-sm text-ink-soft">
                {view.tries} {view.tries === 1 ? 'try' : 'tries'} so far
              </span>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
