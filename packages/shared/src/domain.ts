/**
 * Domain vocabularies shared by the DB schema (check constraints), zod validators and the UI.
 */
export const GAME_CATEGORIES = [
  'word',
  'geography',
  'logic',
  'trivia',
  'crossword',
  'math',
  'music',
  'visual',
] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  word: 'Word',
  geography: 'Geography',
  logic: 'Logic',
  trivia: 'Trivia',
  crossword: 'Crossword',
  math: 'Math',
  music: 'Music',
  visual: 'Film & visual',
};

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** 1 = custom parser + full stats; 2 = generic parser + manual score; 3 = link only. */
export const TIERS = [1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

export const EMBED_MODES = ['iframe', 'popout', 'native'] as const;
export type EmbedMode = (typeof EMBED_MODES)[number];

/** `user_local`: the puzzle changes at the player's local midnight (+hour). `fixed`: at an hour in one timezone. */
export const RESET_MODES = ['user_local', 'fixed'] as const;
export type ResetMode = (typeof RESET_MODES)[number];

/**
 * How a result is scored, which decides "better":
 *  attempts   fewer is better (Wordle 3/6)
 *  time       fewer seconds is better (Mini)
 *  points     more is better
 *  distance   fewer is better (guesses or km off)
 *  completion solved or not (Tier 3 checkbox)
 */
export const SCORING_TYPES = ['attempts', 'time', 'points', 'distance', 'completion'] as const;
export type ScoringType = (typeof SCORING_TYPES)[number];

export const GAME_STATUSES = ['active', 'possibly_down', 'archived'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const RESULT_SOURCES = ['paste', 'manual', 'checkbox', 'native', 'extension'] as const;
export type ResultSource = (typeof RESULT_SOURCES)[number];

export const GAME_REPORT_KINDS = [
  'wrong_reset',
  'moved',
  'dead',
  'wrong_info',
  'other',
  'auto',
] as const;
export type GameReportKind = (typeof GAME_REPORT_KINDS)[number];

export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected', 'duplicate'] as const;
export const PAIRING_STATUSES = ['pending', 'approved', 'denied', 'consumed', 'expired'] as const;
export const USER_ROLES = ['user', 'mod', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MAX_SHARE_TEXT_LENGTH = 4096;
