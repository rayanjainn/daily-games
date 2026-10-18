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
  CONTENT_STATUSES,
  EMBED_MODES,
  FLAIR_COLORS,
  FRIENDSHIP_STATUSES,
  GROUP_ROLES,
  GAME_CATEGORIES,
  GAME_REPORT_KINDS,
  GAME_STATUSES,
  MAX_COMMENT_BODY,
  MAX_NOTE_LENGTH,
  MAX_POST_BODY,
  MAX_POST_TITLE,
  MAX_SOLUTION_LENGTH,
  MAX_SHARE_TEXT_LENGTH,
  PAIRING_STATUSES,
  REPORT_STATUSES,
  RESET_MODES,
  RESULT_SOURCES,
  SCORING_TYPES,
  SOLUTION_STATUSES,
  SUBMISSION_STATUSES,
  USER_ROLES,
  VOTE_TARGETS,
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
    /** Local time for the daily "streak at risk" nudge; null = off. */
    streakNudgeAt: time('streak_nudge_at'),
    /** Also send reminders by email (only once the address is verified). */
    emailReminders: boolean('email_reminders').notNull().default(false),
    spoilerSafe: boolean('spoiler_safe').notNull().default(true),
    /** Appear by name on the global daily boards of the native games. */
    showOnRankings: boolean('show_on_rankings').notNull().default(true),
    /** Badge levels already announced, by badge id; null until the first visit to Today. */
    badgesSeen: jsonb('badges_seen').$type<Record<string, number> | null>(),
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

/**
 * Long-lived tokens for the browser extension. Only the sha256 of the token is stored; the raw
 * token is shown once when it is made. A token can post results and nothing else.
 */
export const captureTokens = pgTable(
  'capture_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('capture_tokens_token_hash_key').on(t.tokenHash),
    index('capture_tokens_user_idx').on(t.userId),
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
    resetGraceHours: smallint('reset_grace_hours').notNull().default(0),
    resetNote: text('reset_note'),
    puzzleEpoch: date('puzzle_epoch').notNull(),
    epochNumber: integer('epoch_number').notNull(),
    /** false: the game shows no number; `epoch_number` indexes days for storage only */
    numberingPublic: boolean('numbering_public').notNull().default(false),
    parserId: text('parser_id'),
    scoringType: text('scoring_type').$type<(typeof SCORING_TYPES)[number]>().notNull(),
    maxAttempts: smallint('max_attempts'),
    scoringUnit: text('scoring_unit'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** set when a moderator edits the row in the admin UI */
    adminEditedAt: timestamp('admin_edited_at', { withTimezone: true }),
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
    check('games_reset_hour_check', sql`${t.resetHour} BETWEEN -12 AND 23`),
    check('games_reset_grace_check', sql`${t.resetGraceHours} BETWEEN 0 AND 12`),
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
    /** Local time to remind the player if today's puzzle isn't logged yet; null = off. */
    remindAt: time('remind_at'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId] }),
    index('follows_game_idx').on(t.gameId),
    index('follows_remind_idx')
      .on(t.remindAt)
      .where(sql`${t.remindAt} IS NOT NULL`),
  ],
);

/** Games a player doesn't want suggested ("Picked for you"). */
export const pickDismissals = pgTable(
  'pick_dismissals',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

/**
 * A player's session in one native game's puzzle: when they opened it (the clock for timed games)
 * and what they have done so far. The finished result goes to `results` like any other.
 */
export const nativePlays = pgTable(
  'native_plays',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    puzzleNumber: integer('puzzle_number').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Per game: Cipher's guesses, Scramble's solved words, Make It's tries. */
    state: jsonb('state').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    uniqueIndex('native_plays_once_key').on(t.userId, t.gameId, t.puzzleNumber),
    index('native_plays_game_idx').on(t.gameId, t.puzzleNumber),
  ],
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
    /** Played later from the game's archive: counts in stats, never in streaks. */
    fromArchive: boolean('from_archive').notNull().default(false),
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

/** One private notepad per player and game: strategies, openers, things learned. */
export const gameNotes = pgTable(
  'game_notes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId] }),
    check(
      'game_notes_body_length',
      sql`char_length(${t.body}) <= ${sql.raw(String(MAX_NOTE_LENGTH))}`,
    ),
  ],
);

/**
 * Player-submitted answers for past puzzles. Nothing is shown until a moderator approves it, it
 * always links to where the answer came from, and it is never shown for a puzzle the viewer can
 * still play today.
 */
export const solutions = pgTable(
  'solutions',
  {
    id: id(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    puzzleNumber: integer('puzzle_number').notNull(),
    puzzleDate: date('puzzle_date').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    sourceUrl: text('source_url').notNull(),
    status: text('status').$type<(typeof SOLUTION_STATUSES)[number]>().notNull().default('pending'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('solutions_author_puzzle_key').on(t.authorId, t.gameId, t.puzzleNumber),
    index('solutions_game_puzzle_idx').on(t.gameId, t.puzzleNumber, t.status),
    index('solutions_status_idx').on(t.status, t.createdAt),
    check('solutions_status_check', oneOf('status', SOLUTION_STATUSES)),
    check(
      'solutions_body_length',
      sql`char_length(${t.body}) BETWEEN 1 AND ${sql.raw(String(MAX_SOLUTION_LENGTH))}`,
    ),
    check(
      'solutions_source_https',
      sql`${t.sourceUrl} ~ '^https://' AND char_length(${t.sourceUrl}) <= 500`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

/**
 * One row per pair of players, stored once with user_a < user_b. `requested_by` is who sent the
 * request (or, for `blocked`, who blocked). A block hides each player from the other.
 */
export const friendships = pgTable(
  'friendships',
  {
    userA: uuid('user_a')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userB: uuid('user_b')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').$type<(typeof FRIENDSHIP_STATUSES)[number]>().notNull(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userA, t.userB] }),
    index('friendships_user_b_idx').on(t.userB),
    check('friendships_order', sql`${t.userA} < ${t.userB}`),
    check('friendships_status_check', oneOf('status', FRIENDSHIP_STATUSES)),
    check('friendships_requester', sql`${t.requestedBy} IN (${t.userA}, ${t.userB})`),
  ],
);

/** Private groups: a shared leaderboard for friends, family or a team. Joined by invite code. */
export const groups = pgTable(
  'groups',
  {
    id: id(),
    name: text('name').notNull(),
    /** Secret part of the invite link; regenerating it invalidates old links. */
    inviteCode: text('invite_code').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('groups_invite_code_key').on(t.inviteCode),
    check('groups_name_length', sql`char_length(${t.name}) BETWEEN 1 AND 40`),
  ],
);

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<(typeof GROUP_ROLES)[number]>().notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('group_members_user_idx').on(t.userId),
    check('group_members_role_check', oneOf('role', GROUP_ROLES)),
  ],
);

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------

/** The global community plus one per game (created the first time someone opens it). */
export const communities = pgTable(
  'communities',
  {
    id: id(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }),
    rulesMd: text('rules_md').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('communities_slug_key').on(t.slug),
    uniqueIndex('communities_game_key').on(t.gameId),
  ],
);

/** Players who moderate one community (site moderators moderate all of them). */
export const communityModerators = pgTable(
  'community_moderators',
  {
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId] }),
    index('community_mods_user_idx').on(t.userId),
  ],
);

export const flairs = pgTable(
  'flairs',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').$type<(typeof FLAIR_COLORS)[number]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('flairs_community_name_key').on(t.communityId, t.name),
    check('flairs_color_check', oneOf('color', FLAIR_COLORS)),
    check('flairs_name_length', sql`char_length(${t.name}) BETWEEN 1 AND 24`),
  ],
);

export const posts = pgTable(
  'posts',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    bodyMd: text('body_md').notNull().default(''),
    flairId: uuid('flair_id').references(() => flairs.id, { onDelete: 'set null' }),
    /** The automatic thread for one puzzle of a game; comments on it are spoilers. */
    isDailyThread: boolean('is_daily_thread').notNull().default(false),
    puzzleNumber: integer('puzzle_number'),
    spoiler: boolean('spoiler').notNull().default(false),
    score: integer('score').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    status: text('status').$type<(typeof CONTENT_STATUSES)[number]>().notNull().default('visible'),
    createdAt: createdAt(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('posts_community_created_idx').on(t.communityId, t.createdAt),
    uniqueIndex('posts_daily_thread_key')
      .on(t.communityId, t.puzzleNumber)
      .where(sql`${t.isDailyThread}`),
    check('posts_status_check', oneOf('status', CONTENT_STATUSES)),
    check(
      'posts_title_length',
      sql`char_length(${t.title}) BETWEEN 1 AND ${sql.raw(String(MAX_POST_TITLE))}`,
    ),
    check('posts_body_length', sql`char_length(${t.bodyMd}) <= ${sql.raw(String(MAX_POST_BODY))}`),
  ],
);

/**
 * Threaded comments. `path` is the chain of ids from the top-level comment down to this one
 * ("a/b/c"); ids are time-ordered, so sorting by path gives threads in reply order.
 */
export const comments = pgTable(
  'comments',
  {
    id: id(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    bodyMd: text('body_md').notNull(),
    depth: smallint('depth').notNull().default(0),
    path: text('path').notNull(),
    spoiler: boolean('spoiler').notNull().default(false),
    score: integer('score').notNull().default(0),
    status: text('status').$type<(typeof CONTENT_STATUSES)[number]>().notNull().default('visible'),
    createdAt: createdAt(),
  },
  (t) => [
    index('comments_post_path_idx').on(t.postId, t.path),
    check('comments_status_check', oneOf('status', CONTENT_STATUSES)),
    check(
      'comments_body_length',
      sql`char_length(${t.bodyMd}) BETWEEN 1 AND ${sql.raw(String(MAX_COMMENT_BODY))}`,
    ),
  ],
);

export const votes = pgTable(
  'votes',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type').$type<(typeof VOTE_TARGETS)[number]>().notNull(),
    targetId: uuid('target_id').notNull(),
    value: smallint('value').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId] }),
    check('votes_target_check', oneOf('target_type', VOTE_TARGETS)),
    check('votes_value_check', sql`${t.value} IN (-1, 1)`),
  ],
);

/** Player reports on posts and comments, for the moderation queue. */
export const contentReports = pgTable(
  'content_reports',
  {
    id: id(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: text('target_type').$type<(typeof VOTE_TARGETS)[number]>().notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status').$type<(typeof REPORT_STATUSES)[number]>().notNull().default('open'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('content_reports_once_key').on(t.reporterId, t.targetType, t.targetId),
    index('content_reports_status_idx').on(t.status, t.createdAt),
    check('content_reports_target_check', oneOf('target_type', VOTE_TARGETS)),
    check('content_reports_status_check', oneOf('status', REPORT_STATUSES)),
    check('content_reports_reason_length', sql`char_length(${t.reason}) BETWEEN 1 AND 300`),
  ],
);

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

/** A browser's Web Push subscription. One player can have several devices. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    /** "Chrome on Android"-style label so players can tell devices apart. */
    label: text('label'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    failures: integer('failures').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('push_subscriptions_endpoint_key').on(t.endpoint),
    index('push_subscriptions_user_idx').on(t.userId),
    check('push_subscriptions_endpoint_https', sql`${t.endpoint} ~ '^https://'`),
  ],
);

/**
 * One row per reminder sent, keyed so a cron run that repeats (or overlaps) never sends the same
 * reminder twice: "game:<gameId>:<puzzle>" or "streak:<local date>". Pruned after two weeks.
 */
export const reminderDeliveries = pgTable(
  'reminder_deliveries',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key] }),
    index('reminder_deliveries_created_idx').on(t.createdAt),
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
export type NativePlay = typeof nativePlays.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type Result = typeof results.$inferSelect;
export type Solution = typeof solutions.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewResult = typeof results.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type PasskeyCredential = typeof passkeyCredentials.$inferSelect;
