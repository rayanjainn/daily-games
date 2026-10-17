import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  EMBED_MODES,
  GAME_CATEGORIES,
  GAME_REPORT_KINDS,
  GAME_STATUSES,
  MAX_SHARE_TEXT_LENGTH,
  PAIRING_STATUSES,
  REPORT_STATUSES,
  RESET_MODES,
  RESULT_SOURCES,
  SCORING_TYPES,
  SUBMISSION_STATUSES,
  USER_ROLES,
  DIFFICULTIES,
} from '../domain';
import { uuidv7 } from '../util/uuidv7';

const citext = customType<{ data: string }>({ dataType: () => 'citext' });
const bytea = customType<{ data: Uint8Array; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (v) => new Uint8Array(v),
  toDriver: (v) => (typeof Buffer !== 'undefined' ? Buffer.from(v) : v),
});

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** `col IN ('a','b')` check for a text column constrained to a vocabulary. */
const oneOf = (column: string, values: readonly (string | number)[]) =>
  sql.raw(`${column} IN (${values.map((v) => (typeof v === 'number' ? v : `'${v}'`)).join(', ')})`);

// ---------------------------------------------------------------------------
// Identity and auth
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: id(),
    username: citext('username').notNull(),
    displayName: text('display_name'),
    email: citext('email'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    timezone: text('timezone').notNull().default('UTC'),
    quietHoursStart: time('quiet_hours_start'),
    quietHoursEnd: time('quiet_hours_end'),
    spoilerSafe: boolean('spoiler_safe').notNull().default(true),
    prefs: jsonb('prefs')
      .$type<{ sound?: boolean; haptics?: boolean; reducedMotion?: boolean }>()
      .notNull()
      .default({}),
    role: text('role').$type<(typeof USER_ROLES)[number]>().notNull().default('user'),
    recoveryConfirmedAt: timestamp('recovery_confirmed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_username_key').on(t.username),
    uniqueIndex('users_email_key').on(t.email),
    check('users_role_check', oneOf('role', USER_ROLES)),
    check('users_username_format', sql`${t.username}::text ~ '^[a-z0-9_]{3,20}$'`),
  ],
);

export const passkeyCredentials = pgTable(
  'passkey_credentials',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** base64url credential id as returned by the authenticator */
    credentialId: text('credential_id').notNull(),
    publicKey: bytea('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: text('transports')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull().default(false),
    nickname: text('nickname').notNull(),
    aaguid: text('aaguid'),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('passkey_credentials_credential_id_key').on(t.credentialId),
    index('passkey_credentials_user_idx').on(t.userId),
  ],
);

export const recoveryPhraseHashes = pgTable('recovery_phrase_hashes', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  hash: text('hash').notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    /** sha256(token) — the raw token only ever lives in the cookie */
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    /** how the session was created: passkey | recovery | pairing | email */
    method: text('method').notNull(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
);

export const devicePairings = pgTable(
  'device_pairings',
  {
    id: id(),
    codeHash: text('code_hash').notNull(),
    /** secret the new device holds to poll and consume; hashed */
    pollSecretHash: text('poll_secret_hash').notNull(),
    numberMatch: smallint('number_match').notNull(),
    status: text('status').$type<(typeof PAIRING_STATUSES)[number]>().notNull().default('pending'),
    initiatorUserAgent: text('initiator_user_agent'),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('device_pairings_code_hash_key').on(t.codeHash),
    check('device_pairings_status_check', oneOf('status', PAIRING_STATUSES)),
    check('device_pairings_number_check', sql`${t.numberMatch} BETWEEN 10 AND 99`),
  ],
);

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: id(),
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: citext('email').notNull(),
    purpose: text('purpose').$type<'verify' | 'login'>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('email_tokens_token_hash_key').on(t.tokenHash),
    check('email_tokens_purpose_check', oneOf('purpose', ['verify', 'login'])),
  ],
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const games = pgTable(
  'games',
  {
    id: id(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    publisher: text('publisher').notNull(),
    description: text('description').notNull(),
    url: text('url').notNull(),
    category: text('category').$type<(typeof GAME_CATEGORIES)[number]>().notNull(),
    difficulty: text('difficulty').$type<(typeof DIFFICULTIES)[number]>().notNull(),
    tier: smallint('tier').$type<1 | 2 | 3>().notNull(),
    embedMode: text('embed_mode').$type<(typeof EMBED_MODES)[number]>().notNull().default('popout'),
    resetMode: text('reset_mode').$type<(typeof RESET_MODES)[number]>().notNull(),
    resetTz: text('reset_tz'),
    resetHour: smallint('reset_hour').notNull().default(0),
    puzzleEpoch: date('puzzle_epoch').notNull(),
    epochNumber: integer('epoch_number').notNull(),
    parserId: text('parser_id'),
    scoringType: text('scoring_type').$type<(typeof SCORING_TYPES)[number]>().notNull(),
    maxAttempts: smallint('max_attempts'),
    status: text('status').$type<(typeof GAME_STATUSES)[number]>().notNull().default('active'),
    accentColor: text('accent_color').notNull(),
    icon: text('icon').notNull(),
    attributionNote: text('attribution_note').notNull(),
    verifiedEmbeddableAt: timestamp('verified_embeddable_at', { withTimezone: true }),
    verifiedLiveAt: timestamp('verified_live_at', { withTimezone: true }),
    sourceYamlHash: text('source_yaml_hash'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('games_slug_key').on(t.slug),
    index('games_category_idx').on(t.category),
    index('games_status_idx').on(t.status),
    check('games_category_check', oneOf('category', GAME_CATEGORIES)),
    check('games_difficulty_check', oneOf('difficulty', DIFFICULTIES)),
    check('games_tier_check', sql`${t.tier} IN (1, 2, 3)`),
    check('games_embed_mode_check', oneOf('embed_mode', EMBED_MODES)),
    check('games_reset_mode_check', oneOf('reset_mode', RESET_MODES)),
    check('games_reset_hour_check', sql`${t.resetHour} BETWEEN 0 AND 23`),
    check('games_scoring_type_check', oneOf('scoring_type', SCORING_TYPES)),
    check('games_status_check', oneOf('status', GAME_STATUSES)),
    check('games_fixed_reset_has_tz', sql`${t.resetMode} <> 'fixed' OR ${t.resetTz} IS NOT NULL`),
    check(
      'games_iframe_requires_probe',
      sql`${t.embedMode} <> 'iframe' OR ${t.verifiedEmbeddableAt} IS NOT NULL`,
    ),
  ],
);

export const gameSubmissions = pgTable(
  'game_submissions',
  {
    id: id(),
    submittedBy: uuid('submitted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    normalizedKey: text('normalized_key').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    resetHint: text('reset_hint'),
    sampleShareText: text('sample_share_text'),
    fetchedTitle: text('fetched_title'),
    fetchedDescription: text('fetched_description'),
    probeResult: jsonb('probe_result'),
    status: text('status')
      .$type<(typeof SUBMISSION_STATUSES)[number]>()
      .notNull()
      .default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check('game_submissions_status_check', oneOf('status', SUBMISSION_STATUSES)),
    // Only one open submission per normalized URL.
    uniqueIndex('game_submissions_open_key')
      .on(t.normalizedKey)
      .where(sql`status = 'pending'`),
  ],
);

export const gameReports = pgTable(
  'game_reports',
  {
    id: id(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').$type<(typeof GAME_REPORT_KINDS)[number]>().notNull(),
    details: text('details'),
    status: text('status').$type<(typeof REPORT_STATUSES)[number]>().notNull().default('open'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('game_reports_status_idx').on(t.status, t.createdAt),
    check('game_reports_kind_check', oneOf('kind', GAME_REPORT_KINDS)),
    check('game_reports_status_check', oneOf('status', REPORT_STATUSES)),
    check('game_reports_details_length', sql`char_length(${t.details}) <= 1000`),
  ],
);

export const gameHealthChecks = pgTable(
  'game_health_checks',
  {
    id: id(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    ok: boolean('ok').notNull(),
    httpStatus: smallint('http_status'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    xFrameOptions: text('x_frame_options'),
    cspFrameAncestors: text('csp_frame_ancestors'),
    error: text('error'),
  },
  (t) => [index('game_health_checks_game_idx').on(t.gameId, t.checkedAt)],
);

// ---------------------------------------------------------------------------
// Play and stats
// ---------------------------------------------------------------------------

export const follows = pgTable(
  'follows',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] }), index('follows_game_idx').on(t.gameId)],
);

export type ResultDetails = {
  grid?: string;
  boards?: (number | null)[];
  hints?: number;
  mistakes?: number;
  [k: string]: unknown;
};

export const results = pgTable(
  'results',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    puzzleNumber: integer('puzzle_number').notNull(),
    puzzleDate: date('puzzle_date').notNull(),
    solved: boolean('solved').notNull(),
    attempts: smallint('attempts'),
    maxAttempts: smallint('max_attempts'),
    timeSeconds: integer('time_seconds'),
    score: integer('score'),
    details: jsonb('details').$type<ResultDetails>().notNull().default({}),
    rawShareText: text('raw_share_text'),
    source: text('source').$type<(typeof RESULT_SOURCES)[number]>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('results_user_game_puzzle_key').on(t.userId, t.gameId, t.puzzleNumber),
    index('results_user_date_idx').on(t.userId, t.puzzleDate),
    index('results_game_puzzle_idx').on(t.gameId, t.puzzleNumber),
    check('results_source_check', oneOf('source', RESULT_SOURCES)),
    check(
      'results_share_text_length',
      sql`char_length(${t.rawShareText}) <= ${sql.raw(String(MAX_SHARE_TEXT_LENGTH))}`,
    ),
    check(
      'results_attempts_range',
      sql`${t.attempts} IS NULL OR (${t.attempts} >= 0 AND ${t.attempts} <= 100)`,
    ),
    check(
      'results_time_range',
      sql`${t.timeSeconds} IS NULL OR (${t.timeSeconds} >= 0 AND ${t.timeSeconds} < 86400)`,
    ),
  ],
);

/** Cache derived from results; recomputed on every result write. Never the source of truth. */
export const streaks = pgTable(
  'streaks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    current: integer('current').notNull().default(0),
    best: integer('best').notNull().default(0),
    lastPuzzleNumber: integer('last_puzzle_number'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

// ---------------------------------------------------------------------------
// Moderation audit (append-only; enforced by trigger in the migration)
// ---------------------------------------------------------------------------

export const modActions = pgTable(
  'mod_actions',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason'),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: createdAt(),
  },
  (t) => [
    index('mod_actions_target_idx').on(t.targetType, t.targetId),
    index('mod_actions_created_idx').on(t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type PasskeyCredential = typeof passkeyCredentials.$inferSelect;
