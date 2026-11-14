'use client';

import { Lightbulb, RotateCcw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { GlowView } from '@/server/native';
import { ResultCard } from './result-card';
import { useNative } from './use-native';

const N = 5;

function tap(board: readonly boolean[], i: number): boolean[] {
  const b = [...board];
  const r = Math.floor(i / N);
  const c = i % N;
  for (const [y, x] of [
    [r, c],
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ] as const)
    if (y >= 0 && y < N && x >= 0 && x < N) b[y * N + x] = !b[y * N + x];
  return b;
}

/**
 * Played on this device; when the board goes dark the taps are sent and the server replays
 * them on the day's board. Resetting is free, so only the final route counts.
 */
export function GlowGame({ initial }: { initial: GlowView }) {
  const { view, busy, error, send } = useNative('glow', initial);
  const reduce = useReducedMotion();
  const [board, setBoard] = useState(view.board);
  const [taps, setTaps] = useState<number[]>([]);
  const lit = board.filter(Boolean).length;
  const done = view.finished;

  async function press(i: number) {
    if (done || busy || taps.length >= view.maxTaps) return;
    const next = tap(board, i);
    const route = [...taps, i];
    setBoard(next);
    setTaps(route);
    if (next.every((v) => !v)) await send({ action: 'taps', taps: route });
  }

  return (
    <div className="flex flex-col gap-5" data-testid="glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          Tapping a light flips it and its neighbours. Turn every light off. Par is {view.par}.
        </p>
        <p className="font-display text-xl font-bold tabular-nums" data-testid="glow-taps">
          {done ? '' : `${taps.length} tap${taps.length === 1 ? '' : 's'}`}
        </p>
      </div>
      <div
        className="mx-auto grid w-full max-w-xs grid-cols-5 gap-2"
        role="group"
        aria-label={`Lights, ${lit} on`}
      >
        {board.map((on, i) => (
          <motion.button
            key={i}
            type="button"
            aria-label={`Light ${Math.floor(i / N) + 1}-${(i % N) + 1}`}
            aria-pressed={on}
            disabled={done}
            onClick={() => void press(i)}
            whileTap={reduce ? undefined : { scale: 0.88 }}
            animate={reduce ? undefined : { scale: on ? 1 : 0.94 }}
            className={cn(
              'grid aspect-square place-items-center rounded-lg border-[length:var(--bw)] border-line transition-colors',
              on
                ? 'bg-sun text-on-sun shadow-[0_0_18px_var(--sun)]'
                : 'bg-surface-2 text-ink-faint',
            )}
          >
            <Lightbulb className="size-5" aria-hidden />
          </motion.button>
        ))}
      </div>
      {!done ? (
        <Button
          variant="ghost"
          className="mx-auto"
          disabled={!taps.length || busy}
          onClick={() => {
            setBoard(view.board);
            setTaps([]);
          }}
        >
          <RotateCcw aria-hidden /> Start over
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {done && view.result ? (
        <ResultCard
          slug="glow"
          heading="Lights out!"
          summary={view.result.summary}
          shareText={view.result.shareText}
        />
      ) : null}
    </div>
  );
}
