import { nextResetAt, type ResetRule } from '@everydaily/shared/time/puzzle';

const clock = (hour: number) => {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "America/New_York" → "New York". */
export const cityOf = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

/**
 * Plain-language reset time: when the puzzle changes, and for fixed-zone games what that is
 * on the player's clock.
 */
export function describeReset(
  rule: ResetRule,
  userTz: string,
  now = new Date(),
): { headline: string; detail: string | null } {
  const hour = rule.hour ?? 0;
  const evening = hour < 0 ? ' the evening before' : '';
  if (rule.mode === 'user_local') {
    return { headline: `New puzzle at ${clock(hour)}${evening}, your time`, detail: null };
  }
  const tz = rule.timezone!;
  const next = nextResetAt(rule, now, userTz);
  const local = new Intl.DateTimeFormat('en-US', {
    timeZone: userTz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(next);
  return {
    headline: `New puzzle at ${clock(hour)}${evening}, ${cityOf(tz)} time`,
    detail: cityOf(tz) === cityOf(userTz) ? null : `That's ${local} where you are.`,
  };
}
