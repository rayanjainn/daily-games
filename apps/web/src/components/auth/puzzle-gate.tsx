'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Delete, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Gate {
  id: string;
  letters: string[];
  seconds: number;
}

/**
 * The warm-up unscramble. Tap tiles (or type) to spell the word. Running out of time just deals
 * a new puzzle; there is no penalty, so nobody is locked out by the timer.
 */
export function PuzzleGate({ onPass }: { onPass: (pass: string) => void }) {
  const [gate, setGate] = useState<Gate | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong' | 'solved' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [left, setLeft] = useState(20);
  const reduce = useReducedMotion();
  const dealing = useRef(false);

  const deal = useCallback(async (note = '') => {
    if (dealing.current) return;
    dealing.current = true;
    try {
      const g = await api<Gate>('/api/auth/gate/start', {});
      setGate(g);
      setPicked([]);
      setLeft(g.seconds);
      setStatus('idle');
      setMessage(note);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Could not load the puzzle.');
    } finally {
      dealing.current = false;
    }
  }, []);

  useEffect(() => {
    void deal();
  }, [deal]);

  useEffect(() => {
    if (!gate || status === 'solved' || status === 'checking') return;
    if (left <= 0) {
      void deal("Time's up! Here's a fresh one.");
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [gate, left, status, deal]);

  const submit = useCallback(
    async (indices: number[]) => {
      if (!gate) return;
      setStatus('checking');
      const answer = indices.map((i) => gate.letters[i]).join('');
      try {
        const { pass } = await api<{ pass: string }>('/api/auth/gate/solve', {
          id: gate.id,
          answer,
        });
        setStatus('solved');
        setMessage('Nice!');
        setTimeout(() => onPass(pass), reduce ? 0 : 650);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : '';
        if (code === 'gate_wrong') {
          setStatus('wrong');
          setMessage('Not quite. Try again!');
          setTimeout(() => {
            setPicked([]);
            setStatus('idle');
          }, 450);
        } else {
          void deal(err instanceof ApiError ? err.message : 'Here is a fresh puzzle.');
        }
      }
    },
    [gate, onPass, reduce, deal],
  );

  const pick = useCallback(
    (i: number) => {
      if (!gate || status !== 'idle' || picked.includes(i)) return;
      const next = [...picked, i];
      setPicked(next);
      if (next.length === gate.letters.length) void submit(next);
    },
    [gate, picked, status, submit],
  );

  const undo = useCallback(() => {
    if (status === 'idle') setPicked((p) => p.slice(0, -1));
  }, [status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!gate || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        undo();
        return;
      }
      if (/^[a-z]$/i.test(e.key)) {
        const idx = gate.letters.findIndex(
          (l, i) => l === e.key.toUpperCase() && !picked.includes(i),
        );
        if (idx !== -1) pick(idx);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gate, picked, pick, undo]);

  if (!gate) {
    return (
      <div className="flex flex-col items-center gap-4 py-8" aria-busy>
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="size-12 animate-pulse rounded-md border-[length:var(--bw)] border-line bg-surface-3"
            />
          ))}
        </div>
        {status === 'error' ? (
          <>
            <p className="text-danger">{message}</p>
            <Button variant="secondary" size="sm" onClick={() => void deal()}>
              Try again
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  const pct = Math.max(0, left / gate.seconds);
  return (
    <div className="flex flex-col items-center gap-5" data-testid="puzzle-gate">
      <div
        className="h-3 w-full overflow-hidden rounded-pill border-2 border-line bg-surface"
        aria-hidden
      >
        <div
          className={cn(
            'h-full transition-[width] duration-1000 ease-linear',
            pct > 0.3 ? 'bg-mint' : 'bg-sun',
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {left} seconds left
      </p>

      {/* Answer slots */}
      <motion.div
        className="flex gap-1.5 sm:gap-2"
        animate={status === 'wrong' && !reduce ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.36 }}
        aria-label={`Your answer: ${picked.map((i) => gate.letters[i]).join('') || 'empty'}`}
        role="status"
      >
        {gate.letters.map((_, slot) => {
          const letterIndex = picked[slot];
          const letter = letterIndex === undefined ? '' : gate.letters[letterIndex];
          return (
            <motion.div
              key={slot}
              className={cn(
                'grid size-11 place-items-center rounded-md border-[length:var(--bw-thick)] font-display text-xl font-bold sm:size-14 sm:text-2xl',
                letter
                  ? 'border-line bg-surface shadow-lift-sm'
                  : 'border-dashed border-line-soft bg-transparent',
                status === 'solved' && 'border-line bg-mint text-on-mint',
                status === 'wrong' && 'border-danger',
              )}
              animate={status === 'solved' && !reduce ? { rotateX: [0, 90, 0] } : {}}
              transition={{ delay: slot * 0.07, duration: 0.35 }}
            >
              {letter}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Letter tiles */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2.5">
        {gate.letters.map((l, i) => {
          const used = picked.includes(i);
          return (
            <button
              key={`${gate.id}-${i}`}
              type="button"
              onClick={() => pick(i)}
              disabled={used || status !== 'idle'}
              aria-label={`Letter ${l}`}
              className={cn(
                'grid size-12 place-items-center rounded-lg border-[length:var(--bw-thick)] border-line font-display text-2xl font-bold sm:size-14',
                'bg-sun text-on-sun shadow-lift-md transition-[transform,box-shadow,opacity] duration-[var(--dur-instant)]',
                'active:translate-y-[var(--lift-md)] active:shadow-none',
                used && 'translate-y-[var(--lift-md)] opacity-30 shadow-none',
              )}
            >
              {l}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={undo}
          disabled={!picked.length || status !== 'idle'}
        >
          <Delete aria-hidden /> Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void deal()}
          disabled={status === 'checking'}
        >
          <RotateCcw aria-hidden /> New letters
        </Button>
      </div>
      <p
        className={cn(
          'min-h-6 font-display font-semibold',
          status === 'solved'
            ? 'text-success'
            : status === 'wrong'
              ? 'text-danger'
              : 'text-ink-soft',
        )}
        aria-live="polite"
      >
        {message}
      </p>
    </div>
  );
}
