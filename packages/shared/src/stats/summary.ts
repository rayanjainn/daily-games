import type { ScoringType } from '../domain';
import { formatDuration, type ResultLike } from './format';
import { computeStreak, type Streak } from './streak';

export interface StatResult extends ResultLike {
  puzzleNumber: number;
  puzzleDate: string;
}

export interface DistributionBar {
  label: string;
  count: number;
  /** marks the bar today's result falls in */
  current: boolean;
}

export interface GameStats {
  played: number;
  solved: number;
  /** 0..100, rounded */
  solveRate: number;
  streak: Streak;
  /** solve streaks (consecutive solved puzzles), separate from the play streak */
  winStreak: { current: number; best: number };
  distribution: DistributionBar[];
  average: string | null;
  best: string | null;
}

const lowerIsBetter = (t: ScoringType) => t === 'attempts' || t === 'time' || t === 'distance';

function valueOf(r: ResultLike, t: ScoringType): number | null {
  if (!r.solved) return null;
  if (t === 'attempts') return r.attempts;
  if (t === 'time') return r.timeSeconds;
  if (t === 'points' || t === 'distance') return r.score;
  return null;
}

function show(v: number, t: ScoringType, unit?: string | null): string {
  if (t === 'time') return formatDuration(Math.round(v));
  if (t === 'attempts') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  const n = Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

/** Splits a value range into up to `n` even buckets with friendly edges. */
function buckets(values: number[], n: number, fmt: (v: number) => string) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, label: fmt(min) }];
  const raw = (max - min) / n;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const start = Math.floor(min / step) * step;
  const out = [];
  for (let from = start; from <= max; from += step) {
    out.push({ from, to: from + step - 1e-9, label: `${fmt(from)}–${fmt(from + step)}` });
  }
  return out;
}

function distribution(
  results: StatResult[],
  scoring: { type: ScoringType; maxAttempts?: number | null; unit?: string | null },
  todayNumber: number,
): DistributionBar[] {
  const today = results.find((r) => r.puzzleNumber === todayNumber);
  const t = scoring.type;
  if (t === 'completion') return [];
  if (t === 'attempts') {
    const max = scoring.maxAttempts ?? Math.max(1, ...results.map((r) => r.attempts ?? 0));
    const bars: DistributionBar[] = Array.from({ length: max }, (_, i) => ({
      label: String(i + 1),
      count: results.filter((r) => r.solved && r.attempts === i + 1).length,
      current: Boolean(today?.solved && today.attempts === i + 1),
    }));
    bars.push({
      label: 'X',
      count: results.filter((r) => !r.solved).length,
      current: Boolean(today && !today.solved),
    });
    return bars;
  }
  const solvedValues = results.map((r) => valueOf(r, t)).filter((v): v is number => v !== null);
  if (!solvedValues.length) return [];
  const fmt = (v: number) => show(v, t, null);
  const bars = buckets(solvedValues, 6, fmt).map((b) => ({
    label: b.label,
    count: solvedValues.filter((v) => v >= b.from && v <= b.to).length,
    current: (() => {
      const v = today ? valueOf(today, t) : null;
      return v !== null && v >= b.from && v <= b.to;
    })(),
  }));
  const unsolved = results.filter((r) => !r.solved).length;
  if (unsolved)
    bars.push({ label: 'Unsolved', count: unsolved, current: Boolean(today && !today.solved) });
  return bars;
}

/**
 * Everything the game page shows from one game's results: play and solve streaks, solve rate,
 * distribution, average and personal best (by the game's scoring direction).
 */
export function computeGameStats(
  results: StatResult[],
  scoring: { type: ScoringType; maxAttempts?: number | null; unit?: string | null },
  todayNumber: number,
): GameStats {
  const played = results.length;
  const solvedList = results.filter((r) => r.solved);
  const solved = solvedList.length;

  const sorted = [...results].sort((a, b) => a.puzzleNumber - b.puzzleNumber);
  let run = 0;
  let bestWin = 0;
  let prev: number | null = null;
  for (const r of sorted) {
    // A skipped puzzle or a loss ends the run.
    if (prev !== null && r.puzzleNumber !== prev + 1) run = 0;
    run = r.solved ? run + 1 : 0;
    bestWin = Math.max(bestWin, run);
    prev = r.puzzleNumber;
  }
  const last = sorted[sorted.length - 1];
  const alive = last && last.puzzleNumber >= todayNumber - 1;
  const currentWin = alive ? run : 0;

  const values = solvedList
    .map((r) => valueOf(r, scoring.type))
    .filter((v): v is number => v !== null);
  const average = values.length
    ? show(values.reduce((a, b) => a + b, 0) / values.length, scoring.type, scoring.unit)
    : null;
  const bestValue = values.length
    ? lowerIsBetter(scoring.type)
      ? Math.min(...values)
      : Math.max(...values)
    : null;

  return {
    played,
    solved,
    solveRate: played ? Math.round((solved / played) * 100) : 0,
    streak: computeStreak(
      results.map((r) => r.puzzleNumber),
      todayNumber,
    ),
    winStreak: { current: currentWin, best: bestWin },
    distribution: distribution(results, scoring, todayNumber),
    average: scoring.type === 'completion' ? null : average,
    best:
      bestValue === null || scoring.type === 'completion'
        ? null
        : show(bestValue, scoring.type, scoring.unit),
  };
}
