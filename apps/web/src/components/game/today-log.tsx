'use client';

import { CheckCircle2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { LogPanel, type LoggableGame } from './log-panel';

/**
 * Today's result on a game page: the logged result with an undo, or the log panel. State is
 * kept here so a refresh after saving doesn't swap the panel out from under the player.
 */
export function TodayLog({
  game,
  logged,
}: {
  game: LoggableGame;
  logged: { id: string; summary: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState(logged);
  const [busy, setBusy] = useState(false);

  if (!current) return <LogPanel game={game} />;

  async function undo() {
    setBusy(true);
    try {
      await api(`/api/results/${current!.id}`, {}, 'DELETE');
      setCurrent(null);
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: err instanceof ApiError ? err.message : 'Could not undo.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center" data-testid="logged-today">
      <CheckCircle2 className="size-10 text-success" aria-hidden />
      <p className="font-display text-2xl font-bold">Today: {current.summary}</p>
      <p className="text-sm text-ink-soft">Logged. Come back tomorrow for the next one.</p>
      <Button variant="ghost" size="sm" onClick={undo} loading={busy}>
        <Undo2 aria-hidden />
        Remove and log again
      </Button>
    </div>
  );
}
