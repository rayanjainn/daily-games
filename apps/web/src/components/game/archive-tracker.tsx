'use client';

import { Archive, Check, History as HistoryIcon, X } from 'lucide-react';
import { useState } from 'react';
import type { ArchiveDay } from '@everydaily/shared/stats/archive';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { LogPanel, type ArchiveTarget, type LoggableGame } from './log-panel';

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

function targetFor(day: ArchiveDay, numbered: boolean): ArchiveTarget {
  const date = dayLabel(day.puzzleDate);
  return {
    puzzleNumber: day.puzzleNumber,
    label: numbered ? `#${day.puzzleNumber.toLocaleString('en-US')} · ${date}` : date,
  };
}

/**
 * The last two weeks of puzzles for one game: a strip showing played, caught-up and missed days,
 * and a list of missed days with a way to log each one after playing it from the archive.
 */
export function ArchiveTracker({
  game,
  days,
  numbered,
  archiveUrl,
}: {
  game: LoggableGame;
  days: ArchiveDay[];
  numbered: boolean;
  /** The game's own site, where most games keep their archive. */
  archiveUrl: string;
}) {
  const [target, setTarget] = useState<ArchiveTarget | null>(null);
  const missed = days.filter((d) => !d.logged);
  const played = days.length - missed.length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        {missed.length
          ? `You played ${played} of the last ${days.length} ${days.length === 1 ? 'puzzle' : 'puzzles'}. `
          : `All caught up on the last ${days.length === 1 ? 'puzzle' : `${days.length} puzzles`}. `}
        Catch-ups count in your stats but never repair a streak.
      </p>

      <ol className="flex flex-wrap gap-1.5" aria-label="Recent puzzles, newest first">
        {days.map((d) => {
          const state = !d.logged ? 'missed' : d.logged.fromArchive ? 'caught up' : 'played';
          return (
            <li
              key={d.puzzleNumber}
              className={cn(
                'grid size-8 place-items-center rounded-md border-2',
                state === 'played' && 'border-success/40 bg-success-soft text-success',
                state === 'caught up' && 'border-info/40 bg-info-soft text-info',
                state === 'missed' && 'border-dashed border-line-soft text-ink-faint',
              )}
              title={`${targetFor(d, numbered).label}: ${state}`}
            >
              {state === 'played' ? (
                <Check className="size-4" aria-hidden />
              ) : state === 'caught up' ? (
                <Archive className="size-4" aria-hidden />
              ) : (
                <X className="size-3.5" aria-hidden />
              )}
              <span className="sr-only">
                {targetFor(d, numbered).label}: {state}
              </span>
            </li>
          );
        })}
      </ol>

      {missed.length ? (
        <ul className="divide-y-2 divide-line-soft" data-testid="missed-days">
          {missed.map((d) => {
            const t = targetFor(d, numbered);
            return (
              <li key={d.puzzleNumber} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-semibold">{t.label}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTarget(t)}
                  aria-label={`Log ${t.label}`}
                >
                  <HistoryIcon aria-hidden />
                  Log
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        {target ? (
          <DialogContent
            title={`Catch up: ${target.label}`}
            description={
              <>
                Play it from the archive on{' '}
                <a
                  href={archiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline decoration-2 underline-offset-2"
                >
                  {new URL(archiveUrl).hostname.replace(/^www\./, '')}
                </a>
                , then log it here.
              </>
            }
          >
            <LogPanel game={game} archive={target} />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
