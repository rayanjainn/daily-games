'use client';

import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Up/down votes with the score between. Optimistic, rolled back if the save fails. */
export function VoteButtons({
  type,
  id,
  score,
  myVote,
  disabled = false,
  label,
}: {
  type: 'post' | 'comment';
  id: string;
  score: number;
  myVote: number;
  disabled?: boolean;
  /** What is being voted on, for screen readers ("this post"). */
  label: string;
}) {
  const toast = useToast();
  const [state, setState] = useState({ score, myVote });
  async function cast(value: -1 | 1) {
    const next = state.myVote === value ? 0 : value;
    const prev = state;
    setState({ score: state.score + next - state.myVote, myVote: next });
    try {
      const r = await api<{ score: number; myVote: number }>(`/api/votes/${type}/${id}`, {
        value: next,
      });
      setState(r);
    } catch (err) {
      setState(prev);
      toast({ tone: 'error', title: err instanceof ApiError ? err.message : 'Vote not saved.' });
    }
  }
  const btn =
    'grid size-8 place-items-center rounded-md text-ink-soft hover:bg-surface-2 hover:text-ink disabled:opacity-50';
  return (
    <div className="flex items-center gap-0.5" data-testid={`votes-${id}`}>
      <button
        type="button"
        className={cn(btn, state.myVote === 1 && 'text-success')}
        aria-label={`Upvote ${label}`}
        aria-pressed={state.myVote === 1}
        disabled={disabled}
        onClick={() => cast(1)}
      >
        <ArrowBigUp
          className="size-5"
          fill={state.myVote === 1 ? 'currentColor' : 'none'}
          aria-hidden
        />
      </button>
      <span
        className="min-w-6 text-center font-display text-sm font-bold tabular-nums"
        data-testid="score"
      >
        {state.score}
      </span>
      <button
        type="button"
        className={cn(btn, state.myVote === -1 && 'text-danger')}
        aria-label={`Downvote ${label}`}
        aria-pressed={state.myVote === -1}
        disabled={disabled}
        onClick={() => cast(-1)}
      >
        <ArrowBigDown
          className="size-5"
          fill={state.myVote === -1 ? 'currentColor' : 'none'}
          aria-hidden
        />
      </button>
    </div>
  );
}
