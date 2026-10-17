import type { ScoringType } from '../domain';
import { formatResult, type ResultLike } from './format';

export interface BoardEntry {
  userId: string;
  name: string;
  result: ResultLike | null;
}

export interface RankedEntry {
  userId: string;
  name: string;
  /** 1-based; equal results share a rank. null = hasn't played yet. */
  rank: number | null;
  summary: string | null;
  solved: boolean | null;
  /** Their result is withheld from the viewer (spoiler-safe). */
  hidden: boolean;
}

function sortValue(r: ResultLike, t: ScoringType): number {
  const v =
    t === 'attempts'
      ? r.attempts
      : t === 'time'
        ? r.timeSeconds
        : t === 'points' || t === 'distance'
          ? r.score
          : 0;
  const n = v ?? 0;
  // Bigger is better for points; flip it so every type sorts ascending.
  return t === 'points' ? -n : n;
}

/**
 * Today's board for one game. Solved beats unsolved, then the better score; ties share a rank.
 * Players who haven't played are listed last, unranked. When `hideScores` is set (spoiler-safe
 * viewer who hasn't played yet) everyone still shows as played or not, but no scores or ranks.
 */
export function rankDay(
  entries: BoardEntry[],
  scoring: ScoringType,
  opts: { hideScores: boolean; viewerId: string },
): RankedEntry[] {
  const played = entries.filter((e) => e.result);
  const waiting = entries.filter((e) => !e.result);
  played.sort((a, b) => {
    const ra = a.result!;
    const rb = b.result!;
    if (ra.solved !== rb.solved) return ra.solved ? -1 : 1;
    if (!ra.solved) return a.name.localeCompare(b.name);
    return sortValue(ra, scoring) - sortValue(rb, scoring) || a.name.localeCompare(b.name);
  });
  const out: RankedEntry[] = [];
  let rank = 0;
  let prevKey: string | null = null;
  played.forEach((e, i) => {
    const r = e.result!;
    const key = r.solved ? String(sortValue(r, scoring)) : 'unsolved';
    if (key !== prevKey) rank = i + 1;
    prevKey = key;
    const hide = opts.hideScores && e.userId !== opts.viewerId;
    out.push({
      userId: e.userId,
      name: e.name,
      rank: hide ? null : rank,
      summary: hide ? null : formatResult(r, { type: scoring }),
      solved: hide ? null : r.solved,
      hidden: hide,
    });
  });
  for (const e of waiting.sort((a, b) => a.name.localeCompare(b.name)))
    out.push({
      userId: e.userId,
      name: e.name,
      rank: null,
      summary: null,
      solved: null,
      hidden: false,
    });
  return out;
}

export interface WeekRow {
  userId: string;
  name: string;
  played: number;
  solved: number;
}

/** The week's board across all games: most solves first, then most played. */
export function rankWeek(rows: WeekRow[]): (WeekRow & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => b.solved - a.solved || b.played - a.played || a.name.localeCompare(b.name),
  );
  let rank = 0;
  return sorted.map((r, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.solved !== r.solved || prev.played !== r.played) rank = i + 1;
    return { ...r, rank };
  });
}
