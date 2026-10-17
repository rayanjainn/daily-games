import type { ScoringType } from '../domain';

export interface ResultLike {
  solved: boolean;
  attempts: number | null;
  maxAttempts: number | null;
  timeSeconds: number | null;
  score: number | null;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/** Short, game-style summary of one result: "4/6", "X/6", "0:42", "1,250 pts", "Done". */
export function formatResult(
  r: ResultLike,
  scoring: { type: ScoringType; unit?: string | null },
): string {
  switch (scoring.type) {
    case 'attempts':
      if (r.attempts === null) return r.solved ? 'Solved' : 'Not solved';
      return `${r.solved ? r.attempts : 'X'}/${r.maxAttempts ?? '?'}`;
    case 'time':
      if (r.timeSeconds === null) return r.solved ? 'Solved' : 'Not solved';
      return r.solved
        ? formatDuration(r.timeSeconds)
        : `${formatDuration(r.timeSeconds)} (unsolved)`;
    case 'points':
    case 'distance':
      if (r.score === null) return r.solved ? 'Solved' : 'Not solved';
      return `${r.score.toLocaleString('en-US')} ${scoring.unit ?? (scoring.type === 'points' ? 'pts' : '')}`.trim();
    case 'completion':
      return 'Done';
  }
}
