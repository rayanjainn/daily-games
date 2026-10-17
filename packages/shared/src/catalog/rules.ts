import { z } from 'zod';
import { contrastRatio, readableOn } from '../color';
import {
  DIFFICULTIES,
  EMBED_MODES,
  GAME_CATEGORIES,
  GAME_STATUSES,
  RESET_MODES,
  SCORING_TYPES,
  type EmbedMode,
  type ResetMode,
  type ScoringType,
  type Tier,
} from '../domain';
import { ICON_KEYS } from '../registry/icons';
import { isValidTimeZone, parseIsoDate } from '../time/zoned';

/** Flat view of the fields the catalog rules constrain (shared by YAML specs and DB rows). */
export interface RuleSubject {
  tier: Tier;
  parserId: string | null;
  embedMode: EmbedMode;
  verifiedEmbeddableAt: string | Date | null;
  scoringType: ScoringType;
  maxAttempts: number | null;
  resetMode: ResetMode;
  resetTz: string | null;
}

export interface RuleIssue {
  path: string;
  message: string;
}

/**
 * Cross-field rules every game must satisfy, in YAML or after a moderator edit:
 * tier decides parser and scoring, iframe needs a passing probe, fixed resets need a zone.
 */
export function gameRuleIssues(g: RuleSubject, knownParsers?: ReadonlySet<string>): RuleIssue[] {
  const out: RuleIssue[] = [];
  const add = (path: string, message: string) => out.push({ path, message });

  if (g.resetMode === 'fixed' && !g.resetTz) add('resetTz', 'fixed resets need a timezone');
  if (g.resetMode === 'user_local' && g.resetTz)
    add('resetTz', 'user_local resets must not set a timezone');
  if (g.embedMode === 'iframe' && !g.verifiedEmbeddableAt)
    add('embedMode', 'iframe requires a passing embed probe (verifiedEmbeddableAt)');
  if (g.embedMode === 'native' && g.tier !== 1) add('embedMode', 'native games are tier 1');
  if (g.tier === 1 && (!g.parserId || g.parserId === 'generic'))
    add('parserId', 'tier 1 needs a dedicated parser');
  if (g.tier === 2 && !g.parserId) add('parserId', 'tier 2 needs a parser (use "generic")');
  if (g.tier === 3 && g.parserId) add('parserId', 'tier 3 games are link-only (no parser)');
  if (g.parserId && knownParsers && !knownParsers.has(g.parserId))
    add('parserId', `no parser called "${g.parserId}"`);
  if (g.scoringType === 'attempts' && !g.maxAttempts)
    add('maxAttempts', 'attempts scoring needs maxAttempts');
  if (g.tier === 3 && g.scoringType !== 'completion')
    add('scoringType', 'tier 3 games score by completion');
  if (g.tier !== 3 && g.scoringType === 'completion')
    add('scoringType', 'tiers 1 and 2 record a score, not just completion');
  return out;
}

const isoDate = z.string().refine((s) => {
  try {
    parseIsoDate(s);
    return true;
  } catch {
    return false;
  }
}, 'expected YYYY-MM-DD');

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullable();

/**
 * Moderator edit of a game row. `verifiedEmbeddableAt` is not editable: only the embed probe
 * sets it, so a moderator can never switch a game to iframe without a passing probe.
 */
export const gameEditSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    publisher: z.string().trim().min(1).max(60),
    description: z.string().trim().min(10).max(160),
    url: z
      .string()
      .trim()
      .url()
      .refine((u) => u.startsWith('https://'), 'must be https'),
    category: z.enum(GAME_CATEGORIES),
    difficulty: z.enum(DIFFICULTIES),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    embedMode: z.enum(EMBED_MODES),
    status: z.enum(GAME_STATUSES),
    resetMode: z.enum(RESET_MODES),
    resetTz: nullableText(64).refine((v) => v === null || isValidTimeZone(v), 'unknown timezone'),
    resetHour: z.number().int().min(-12).max(23),
    resetGraceHours: z.number().int().min(0).max(12),
    resetNote: nullableText(200),
    puzzleEpoch: isoDate,
    epochNumber: z.number().int().min(-100000).max(100000),
    numberingPublic: z.boolean(),
    parserId: nullableText(40).refine((v) => v === null || /^[a-z0-9-]+$/.test(v), 'bad id'),
    scoringType: z.enum(SCORING_TYPES),
    maxAttempts: z.number().int().min(1).max(100).nullable(),
    scoringUnit: nullableText(20),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .refine(
        (c) => contrastRatio(readableOn(c), c) >= 4.5,
        'text on this color would be hard to read (needs 4.5:1 with ink or white)',
      ),
    icon: z.enum(ICON_KEYS),
    attributionNote: z.string().trim().min(10).max(240),
    tags: z.array(z.string().trim().min(1).max(24)).max(8),
    /** why the moderator made the change; kept in the audit log */
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export type GameEdit = z.infer<typeof gameEditSchema>;

/** User-submitted game suggestion (behind FEATURE_SUBMISSIONS). */
export const gameSubmissionSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(500)
      .url()
      .refine((u) => /^https?:\/\//i.test(u), 'must be a web address'),
    name: z.string().trim().min(1).max(40),
    category: z.enum(GAME_CATEGORIES),
    resetHint: z.string().trim().max(120).optional(),
    sampleShareText: z.string().max(1000).optional(),
  })
  .strict();

export type GameSubmissionInput = z.infer<typeof gameSubmissionSchema>;
