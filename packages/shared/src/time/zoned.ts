/**
 * Timezone math on top of Intl only (works in Node, browsers and Workers).
 * Dates are ISO calendar dates ('YYYY-MM-DD'); instants are JS Dates.
 */

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Local wall-clock reading of an instant in a timezone. */
export function wallClock(instant: Date, tz: string): WallClock {
  const parts = formatter(tz).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** Offset of `tz` from UTC at `instant`, in minutes (e.g. +330 for Asia/Kolkata). */
export function offsetMinutes(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

/**
 * The instant at which the wall clock in `tz` reads the given time. Times skipped by a DST
 * jump resolve to the later offset (i.e. just after the gap); repeated times resolve to the
 * first occurrence.
 */
export function zonedTimeToInstant(w: WallClock, tz: string): Date {
  const naive = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const first = naive - offsetMinutes(new Date(naive), tz) * 60_000;
  const second = naive - offsetMinutes(new Date(first), tz) * 60_000;
  if (first === second) return new Date(first);
  // Ambiguous or skipped: prefer the candidate whose wall clock matches; else the later one.
  const matches = (t: number) => {
    const c = wallClock(new Date(t), tz);
    return c.hour === w.hour && c.minute === w.minute && c.day === w.day;
  };
  const candidates = [first, second].sort((a, b) => a - b);
  return new Date(candidates.find(matches) ?? candidates[1]!);
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIsoDate(date: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`invalid ISO date: ${date}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day)
    throw new Error(`invalid ISO date: ${date}`);
  return { year, month, day };
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseIsoDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  const pa = parseIsoDate(a);
  const pb = parseIsoDate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) /
      86_400_000,
  );
}

export function localDate(instant: Date, tz: string): string {
  const w = wallClock(instant, tz);
  return toIsoDate(w.year, w.month, w.day);
}
