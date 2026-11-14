'use client';

import { Delete, Timer } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { SixesView } from '@/server/native';
import { ResultCard } from './result-card';
import { clock, useElapsed, useNative } from './use-native';

const N = 6;

export function SixesGame({ initial }: { initial: SixesView }) {
  const { view, busy, error, send, setError } = useNative('sixes', initial);
  const reduce = useReducedMotion();
  const seconds = useElapsed(view.startedAt, !view.finished);
  const [cells, setCells] = useState<number[]>(view.solution ?? view.givens);
  const [sel, setSel] = useState<number | null>(view.givens.findIndex((v) => v === 0));
  const shown = view.solution ?? cells;
  const filled = shown.every(Boolean);
  const checksLeft = view.maxChecks - view.checksUsed;

  function put(v: number) {
    if (sel === null || view.givens[sel] || view.finished) return;
    setError(null);
    setCells((c) => c.map((x, i) => (i === sel ? v : x)));
  }

  function onKey(e: KeyboardEvent) {
    if (sel === null) return;
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      setSel((s) => Math.min(N * N - 1, Math.max(0, (s ?? 0) + move)));
    } else if (/^[1-6]$/.test(e.key)) put(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') put(0);
  }

  return (
    <div className="flex flex-col gap-5" data-testid="sixes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          Fill the grid so every row, column and 2×3 box has 1 to 6 once. {checksLeft} check
          {checksLeft === 1 ? '' : 's'} left.
        </p>
        <p className="flex items-center gap-1.5 font-display text-xl font-bold tabular-nums">
          <Timer className="size-5 text-ink-soft" aria-hidden />
          {clock(view.finished ? (view.result?.timeSeconds ?? seconds) : seconds)}
        </p>
      </div>
      <div
        role="group"
        aria-label="Sixes grid"
        tabIndex={0}
        onKeyDown={onKey}
        className="mx-auto grid w-full max-w-sm grid-cols-6 overflow-hidden rounded-lg border-[length:var(--bw)] border-line bg-line shadow-lift outline-none focus-visible:ring-4 focus-visible:ring-focus/40"
        style={{ gap: 1 }}
      >
        {shown.map((v, i) => {
          const r = Math.floor(i / N);
          const c = i % N;
          const given = Boolean(view.givens[i]);
          return (
            <motion.button
              key={i}
              type="button"
              aria-label={`Row ${r + 1} column ${c + 1}: ${v || 'empty'}${given ? ', given' : ''}`}
              aria-pressed={sel === i}
              onClick={() => setSel(i)}
              disabled={view.finished}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              className={cn(
                'grid aspect-square place-items-center font-display text-2xl tabular-nums',
                given ? 'bg-surface-2 font-bold text-ink' : 'bg-surface font-semibold text-sky',
                sel === i && !view.finished && 'bg-sun text-on-sun',
                c === 2 && 'mr-[2px]',
                r % 2 === 1 && r < 5 && 'mb-[2px]',
              )}
            >
              {v || ''}
            </motion.button>
          );
        })}
      </div>
      {!view.finished ? (
        <div className="flex flex-col gap-3">
          <div className="mx-auto grid w-full max-w-sm grid-cols-7 gap-2" aria-label="Number pad">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Button key={n} variant="secondary" onClick={() => put(n)} aria-label={`Put ${n}`}>
                {n}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => put(0)} aria-label="Clear square">
              <Delete aria-hidden />
            </Button>
          </div>
          {view.lastWrong ? (
            <p className="text-center text-sm font-semibold text-danger" data-testid="sixes-wrong">
              {view.lastWrong} square{view.lastWrong === 1 ? ' is' : 's are'} wrong. Have another
              look.
            </p>
          ) : null}
          <Button
            size="lg"
            className="mx-auto w-full max-w-sm"
            disabled={!filled}
            loading={busy}
            onClick={() => void send({ action: 'grid', cells })}
          >
            Check grid
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {view.finished && view.result ? (
        <ResultCard
          slug="sixes"
          heading={view.solved ? 'Solved!' : 'Out of checks'}
          summary={view.result.summary}
          shareText={view.result.shareText}
        />
      ) : null}
    </div>
  );
}
