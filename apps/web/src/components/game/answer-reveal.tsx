'use client';

import type { Answer } from '@everydaily/shared/answers';
import { Eye, ExternalLink, Lock } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Revealed {
  answer: Answer;
  puzzleDate: string;
  source: { label: string; url: string };
}

/**
 * Today's answer from the publisher, behind a tap. Locked until the player has logged the puzzle,
 * solved or not, so it can never spoil a game still in progress.
 */
export function AnswerReveal({
  slug,
  date,
  logged,
  sourceLabel,
}: {
  slug: string;
  date: string;
  logged: boolean;
  sourceLabel: string;
}) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<Revealed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!logged)
    return (
      <p className="flex items-start gap-2 text-sm text-ink-soft" data-testid="answer-locked">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Log today&apos;s result (solved or not) and the answer from {sourceLabel} unlocks here.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait" initial={false}>
        {state ? (
          <motion.div
            key="answer"
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            data-testid="answer"
          >
            <AnswerView answer={state.answer} />
            <a
              href={state.source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
            >
              Answer from {state.source.label}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </motion.div>
        ) : (
          <motion.div key="button" exit={reduce ? undefined : { opacity: 0 }}>
            <Button
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  setState(await api<Revealed>(`/api/games/${slug}/answer?date=${date}`));
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Could not load the answer.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Eye aria-hidden /> Reveal today&apos;s answer
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const TONES = [
  'bg-sun text-on-sun',
  'bg-mint text-on-mint',
  'bg-sky text-on-sky',
  'bg-grape text-on-grape',
];

function Tiles({ word, size = 'lg' }: { word: string; size?: 'lg' | 'sm' }) {
  return (
    <span className="flex flex-wrap gap-1.5" aria-label={word} role="img">
      {word.split('').map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'grid place-items-center rounded-md border-[length:var(--bw)] border-line bg-mint font-display font-bold text-on-mint shadow-lift-sm',
            size === 'lg' ? 'size-11 text-xl' : 'size-8 text-base',
          )}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export function AnswerView({ answer }: { answer: Answer }) {
  switch (answer.kind) {
    case 'word':
      return <Tiles word={answer.word} />;
    case 'groups':
      return (
        <ul className="flex flex-col gap-2">
          {answer.groups.map((g, i) => (
            <li key={g.title} className={cn('rounded-lg px-3 py-2.5 text-center', TONES[i % 4])}>
              <p className="font-display text-sm font-bold uppercase tracking-wide">{g.title}</p>
              <p className="text-sm">{g.items.join(', ')}</p>
            </li>
          ))}
        </ul>
      );
    case 'theme':
      return (
        <div className="flex flex-col gap-2">
          {answer.clue ? (
            <p className="text-sm text-ink-soft">
              Theme: <strong className="text-ink">{answer.clue}</strong>
            </p>
          ) : null}
          <p className="w-fit rounded-pill bg-sun px-3 py-1 font-display font-bold text-on-sun">
            {answer.spangram}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {answer.words.map((w) => (
              <li
                key={w}
                className="rounded-pill bg-sky px-3 py-1 font-display text-sm font-semibold text-on-sky"
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'wordlist':
      return <WordList answer={answer} />;
    case 'sequence':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {answer.words.map((w, i) => (
              <span key={w} className="flex items-center gap-2">
                {i ? <span aria-hidden>→</span> : null}
                <Tiles word={w} size="sm" />
              </span>
            ))}
          </div>
          {answer.note ? <p className="text-sm text-ink-soft">{answer.note}</p> : null}
        </div>
      );
    case 'crossword':
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <table className="border-collapse" aria-label="Solved grid">
            <tbody>
              {answer.grid.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={cn(
                        'size-9 border border-line text-center font-display font-bold',
                        cell ? 'bg-surface' : 'bg-ink',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-1 text-sm">
            {answer.clues.map((c) => (
              <li key={`${c.direction}${c.label}`}>
                <strong>
                  {c.label}
                  {c.direction === 'Across' ? 'A' : 'D'}
                </strong>{' '}
                {c.clue} <span className="font-display font-bold">{c.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'numbers':
      return (
        <div className="flex flex-wrap gap-4">
          {answer.grids.map((g) => (
            <figure key={g.level} className="flex flex-col gap-1">
              <figcaption className="font-display text-sm font-semibold">{g.level}</figcaption>
              <table className="border-collapse" aria-label={`${g.level} solution`}>
                <tbody>
                  {g.grid.map((row, r) => (
                    <tr key={r}>
                      {row.map((n, c) => (
                        <td
                          key={c}
                          className={cn(
                            'size-6 border border-line-soft text-center text-xs tabular-nums',
                            c % 3 === 2 && c < 8 && 'border-r-line border-r-2',
                            r % 3 === 2 && r < 8 && 'border-b-line border-b-2',
                          )}
                        >
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          ))}
        </div>
      );
    case 'dominoes':
      return (
        <div className="flex flex-col gap-2 text-sm">
          {answer.levels.map((l) => (
            <div key={l.level}>
              <p className="font-display font-semibold">{l.level}</p>
              <ul className="flex flex-wrap gap-1.5">
                {l.placements.map((p, i) => (
                  <li key={i} className="rounded-md border border-line-soft px-2 py-1 tabular-nums">
                    [{p.pips[0]}|{p.pips[1]}] row {p.cells[0]![0] + 1}, col {p.cells[0]![1] + 1} →{' '}
                    row {p.cells[1]![0] + 1}, col {p.cells[1]![1] + 1}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
  }
}

function WordList({ answer }: { answer: Extract<Answer, { kind: 'wordlist' }> }) {
  const [all, setAll] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-soft">
        Letters <strong className="font-display text-ink tracking-wider">{answer.letters}</strong>{' '}
        (centre {answer.center}) · {answer.words.length} words
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {answer.pangrams.map((w) => (
          <li key={w} className="rounded-pill bg-sun px-3 py-1 font-display font-bold text-on-sun">
            {w}
          </li>
        ))}
      </ul>
      {all ? (
        <p className="text-sm leading-relaxed">{answer.words.join(' · ')}</p>
      ) : (
        <Button size="sm" variant="ghost" className="w-fit" onClick={() => setAll(true)}>
          Show all {answer.words.length} words
        </Button>
      )}
    </div>
  );
}
