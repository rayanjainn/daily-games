import { z } from 'zod';
import { gameRuleIssues } from '../catalog/rules';
import {
  DIFFICULTIES,
  EMBED_MODES,
  GAME_CATEGORIES,
  GAME_STATUSES,
  MAX_SHARE_TEXT_LENGTH,
  RESET_MODES,
  SCORING_TYPES,
} from '../domain';
import { isValidTimeZone, parseIsoDate } from '../time/zoned';
import { ICON_KEYS } from './icons';

const isoDate = z.string().refine((s) => {
  try {
    parseIsoDate(s);
    return true;
  } catch {
    return false;
  }
}, 'expected YYYY-MM-DD');

/** YAML parses unquoted timestamps as Date; accept both and normalize to ISO strings. */
const isoDateTime = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((v) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString()));

/**
 * Catalog entry, one YAML file per game in packages/shared/games/.
 * See PLAN.md section 8 for the pipeline.
 */
export const gameSpecSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(2)
      .max(40),
    name: z.string().min(1).max(40),
    publisher: z.string().min(1).max(60),
    description: z.string().min(10).max(160),
    url: z
      .string()
      .url()
      .refine((u) => u.startsWith('https://'), 'must be https'),
    category: z.enum(GAME_CATEGORIES),
    difficulty: z.enum(DIFFICULTIES),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    embedMode: z.enum(EMBED_MODES).default('popout'),
    reset: z
      .object({
        mode: z.enum(RESET_MODES),
        timezone: z.string().refine(isValidTimeZone, 'unknown IANA timezone').optional(),
        hour: z.number().int().min(-12).max(23).default(0),
        graceHours: z.number().int().min(0).max(12).optional(),
        note: z.string().max(200).optional(),
      })
      .strict(),
    numbering: z
      .object({
        epoch: isoDate,
        epochNumber: z.number().int(),
        /** false = the game shows no number; this index is ours, for storage only. */
        public: z.boolean(),
      })
      .strict(),
    parserId: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .nullable(),
    scoring: z
      .object({
        type: z.enum(SCORING_TYPES),
        maxAttempts: z.number().int().min(1).max(100).optional(),
        unit: z.string().max(20).optional(),
      })
      .strict(),
    shareTextSamples: z.array(z.string().min(1).max(MAX_SHARE_TEXT_LENGTH)).default([]),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    icon: z.enum(ICON_KEYS),
    attribution: z.string().min(10).max(240),
    verifiedLiveAt: isoDateTime.nullable(),
    verifiedEmbeddableAt: isoDateTime.nullable().default(null),
    status: z.enum(GAME_STATUSES).default('active'),
    tags: z.array(z.string().max(24)).max(8).default([]),
  })
  .strict()
  .superRefine((g, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    for (const i of gameRuleIssues({
      tier: g.tier,
      parserId: g.parserId,
      embedMode: g.embedMode,
      verifiedEmbeddableAt: g.verifiedEmbeddableAt,
      scoringType: g.scoring.type,
      maxAttempts: g.scoring.maxAttempts ?? null,
      resetMode: g.reset.mode,
      resetTz: g.reset.timezone ?? null,
    })) {
      issue(SPEC_PATHS[i.path] ?? [i.path], i.message);
    }
    if (g.tier !== 3 && g.shareTextSamples.length === 0) {
      issue(['shareTextSamples'], 'tiers 1 and 2 need at least one share text sample');
    }
  });

/** Where a flat rule path lives in the nested YAML shape. */
const SPEC_PATHS: Record<string, string[]> = {
  resetTz: ['reset', 'timezone'],
  maxAttempts: ['scoring', 'maxAttempts'],
  scoringType: ['scoring', 'type'],
};

export type GameSpecInput = z.input<typeof gameSpecSchema>;
export type GameSpec = z.output<typeof gameSpecSchema>;

/** Lower scores win for these scoring types. */
export function lowerIsBetter(type: GameSpec['scoring']['type']): boolean {
  return type === 'attempts' || type === 'time' || type === 'distance';
}

/** Adapts a spec to the puzzle clock used by the time module. */
export function clockOf(g: Pick<GameSpec, 'reset' | 'numbering'>) {
  return { reset: g.reset, numbering: g.numbering };
}
