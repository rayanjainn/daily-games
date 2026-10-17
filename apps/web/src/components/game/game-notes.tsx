'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MAX_NOTE_LENGTH } from '@everydaily/shared/domain';
import { Textarea } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

type Status = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DELAY_MS = 800;

/**
 * A private notepad for one game. Saves on its own shortly after typing stops and when the
 * field loses focus; only one save is in flight at a time, and the latest text always wins.
 */
export function GameNotes({
  gameId,
  gameName,
  initial,
}: {
  gameId: string;
  gameName: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(initial);
  const latest = useRef(initial);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintId = useId();
  const statusId = useId();

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (saving.current) return;
    saving.current = true;
    try {
      while (latest.current !== saved.current) {
        const body = latest.current;
        setStatus('saving');
        await api(`/api/notes/${gameId}`, { body }, 'PATCH');
        saved.current = body;
      }
      setStatus('saved');
      setError(null);
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Could not save your note.');
    } finally {
      saving.current = false;
    }
  }

  function onChange(value: string) {
    setText(value);
    latest.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  // Save anything pending if the player navigates away mid-typing.
  useEffect(() => {
    const pending = () => {
      if (latest.current !== saved.current) void flush();
    };
    window.addEventListener('pagehide', pending);
    return () => {
      window.removeEventListener('pagehide', pending);
      pending();
    };
    // flush only reads refs, so binding it once is safe.
  }, []);

  const left = MAX_NOTE_LENGTH - text.length;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${hintId}-field`} className="sr-only">
        Your notes for {gameName}
      </label>
      <Textarea
        id={`${hintId}-field`}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void flush()}
        maxLength={MAX_NOTE_LENGTH}
        aria-describedby={`${hintId} ${statusId}`}
        aria-invalid={status === 'error'}
        className="min-h-32 text-sm"
        placeholder="Openers that work, patterns you've spotted, things to try next time…"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p id={hintId} className="text-ink-soft">
          Only you can see these. Saved as you type.
        </p>
        <p
          id={statusId}
          role="status"
          className={cn(
            'font-semibold',
            status === 'error' ? 'text-danger' : 'text-ink-soft',
            left < 200 && status !== 'error' && 'text-warn',
          )}
          data-testid="note-status"
        >
          {status === 'saving'
            ? 'Saving…'
            : status === 'error'
              ? error
              : status === 'saved'
                ? 'Saved'
                : left < 200
                  ? `${left} characters left`
                  : ''}
        </p>
      </div>
    </div>
  );
}
