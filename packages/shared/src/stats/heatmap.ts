import { addDays, parseIsoDate } from '../time/zoned';

export type HeatState = 'solved' | 'failed' | 'none' | 'future';

export interface HeatDay {
  date: string;
  state: HeatState;
}

/**
 * Calendar grid for the last `weeks` weeks ending with the week of `today`: columns are weeks
 * (oldest first), rows are Monday..Sunday. Days after today are `future`.
 */
export function buildHeatmap(
  played: { date: string; solved: boolean }[],
  today: string,
  weeks = 26,
): HeatDay[][] {
  const byDate = new Map<string, boolean>();
  for (const p of played) byDate.set(p.date, (byDate.get(p.date) ?? false) || p.solved);
  const { year, month, day } = parseIsoDate(today);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(today, -weekday - (weeks - 1) * 7);
  const grid: HeatDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const state: HeatState =
        date > today
          ? 'future'
          : byDate.has(date)
            ? byDate.get(date)
              ? 'solved'
              : 'failed'
            : 'none';
      col.push({ date, state });
    }
    grid.push(col);
  }
  return grid;
}
