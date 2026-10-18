'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Move, NativeView } from '@/server/native';

/** Moves in a native game: sends one, keeps the newest view, and reports what went wrong. */
export function useNative<V extends NativeView>(slug: string, initial: V) {
  const [view, setView] = useState<V>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(move: Move): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      setView(await api<V>(`/api/native/${slug}`, move));
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { view, busy, error, send, setError };
}

/** Seconds since `startedAt`, ticking while `running`. */
export function useElapsed(startedAt: string, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
