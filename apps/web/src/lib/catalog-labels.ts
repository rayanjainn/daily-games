import type { Difficulty, EmbedMode, Tier } from '@everydaily/shared/domain';

/** Player-facing names for tiers: what tracking you get, not our internal number. */
export const TRACKING: Record<Tier, { label: string; hint: string }> = {
  1: { label: 'Full stats', hint: 'Paste your result for scores, streaks and charts.' },
  2: { label: 'Score log', hint: 'Paste your result or type your score.' },
  3: { label: 'Check-off', hint: 'Tick it off each day to keep your streak.' },
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const EMBED_LABELS: Record<EmbedMode, string> = {
  iframe: 'Plays here',
  popout: 'Opens on its site',
  native: 'EveryDaily original',
};

/** Host name without `www.`, for showing where a link goes. */
export const siteOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');
