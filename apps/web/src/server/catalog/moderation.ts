import 'server-only';
import { z } from 'zod';
import {
  eq,
  gameReports,
  gameSubmissions,
  games,
  modActions,
  type Database,
  type Game,
} from '@everydaily/shared/db';
import { gameRuleIssues, type GameEdit } from '@everydaily/shared/catalog/rules';
import { DIFFICULTIES } from '@everydaily/shared/domain';
import { PARSERS } from '@everydaily/shared/parsers';
import { ICON_KEYS } from '@everydaily/shared/registry';
import { localDate } from '@everydaily/shared/time/zoned';
import { contrastRatio, readableOn } from '@everydaily/shared/color';
import { db } from '../db';
import { HttpError } from '../session';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function recordModAction(
  tx: Tx | Database,
  a: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.insert(modActions).values({
    actorId: a.actorId,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    reason: a.reason ?? null,
    before: a.before ?? null,
    after: a.after ?? null,
  });
}

const EDITABLE = [
  'name',
  'publisher',
  'description',
  'url',
  'category',
  'difficulty',
  'tier',
  'embedMode',
  'status',
  'resetMode',
  'resetTz',
  'resetHour',
  'resetGraceHours',
  'resetNote',
  'puzzleEpoch',
  'epochNumber',
  'numberingPublic',
  'parserId',
  'scoringType',
  'maxAttempts',
  'scoringUnit',
  'accentColor',
  'icon',
  'attributionNote',
  'tags',
] as const satisfies readonly (keyof GameEdit & keyof Game)[];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Applies a moderator edit: checks the cross-field rules (tier promotion needs the right parser
 * and scoring, iframe needs a passing probe), writes only changed fields and logs before/after.
 */
export async function updateGame(actorId: string, slug: string, edit: GameEdit) {
  return db().transaction(async (tx) => {
    const [row] = await tx.select().from(games).where(eq(games.slug, slug)).for('update');
    if (!row) throw new HttpError(404, 'not_found', 'Game not found.');

    const issues = gameRuleIssues(
      {
        tier: edit.tier,
        parserId: edit.parserId,
        embedMode: edit.embedMode,
        verifiedEmbeddableAt: row.verifiedEmbeddableAt,
        scoringType: edit.scoringType,
        maxAttempts: edit.maxAttempts,
        resetMode: edit.resetMode,
        resetTz: edit.resetTz,
      },
      new Set(Object.keys(PARSERS)),
    );
    if (issues.length) throw new HttpError(400, 'invalid_input', issues[0]!.message, { issues });

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (!same(row[k], edit[k])) {
        before[k] = row[k];
        after[k] = edit[k];
      }
    }
    if (Object.keys(after).length === 0) return { changed: false };

    await tx
      .update(games)
      .set({ ...after, adminEditedAt: new Date(), updatedAt: new Date() } as Partial<Game>)
      .where(eq(games.id, row.id));
    await recordModAction(tx, {
      actorId,
      action: 'tier' in after ? 'game.tier' : 'game.update',
      targetType: 'game',
      targetId: row.id,
      reason: edit.reason,
      before,
      after,
    });
    return { changed: true };
  });
}

export const reportDecisionSchema = z
  .object({
    status: z.enum(['resolved', 'dismissed']),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export async function decideReport(
  actorId: string,
  id: string,
  d: z.infer<typeof reportDecisionSchema>,
) {
  return db().transaction(async (tx) => {
    const [r] = await tx.select().from(gameReports).where(eq(gameReports.id, id)).for('update');
    if (!r) throw new HttpError(404, 'not_found', 'Report not found.');
    if (r.status !== 'open') throw new HttpError(409, 'already_decided', 'Already handled.');
    await tx
      .update(gameReports)
      .set({ status: d.status, resolvedBy: actorId, resolvedAt: new Date() })
      .where(eq(gameReports.id, id));
    await recordModAction(tx, {
      actorId,
      action: `report.${d.status === 'resolved' ? 'resolve' : 'dismiss'}`,
      targetType: 'game_report',
      targetId: id,
      reason: d.reason,
      before: { status: r.status },
      after: { status: d.status },
    });
  });
}

/** Slugs that collide with static routes under /games. */
const RESERVED_SLUGS = new Set(['suggest', 'new', 'search']);

/** Approving a submission creates a Tier 3, popout, link-only game. */
export const submissionDecisionSchema = z.discriminatedUnion('decision', [
  z
    .object({
      decision: z.literal('approve'),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase letters, digits and dashes')
        .min(2)
        .max(40)
        .refine((s) => !RESERVED_SLUGS.has(s), 'that slug is reserved'),
      name: z.string().trim().min(1).max(40),
      publisher: z.string().trim().min(1).max(60),
      description: z.string().trim().min(10).max(160),
      difficulty: z.enum(DIFFICULTIES),
      accentColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .refine((c) => contrastRatio(readableOn(c), c) >= 4.5, 'accent is not readable'),
      icon: z.enum(ICON_KEYS),
      reason: z.string().trim().max(300).optional(),
    })
    .strict(),
  z
    .object({
      decision: z.enum(['reject', 'duplicate']),
      reason: z.string().trim().max(300).optional(),
    })
    .strict(),
]);

export async function decideSubmission(
  actorId: string,
  id: string,
  d: z.infer<typeof submissionDecisionSchema>,
) {
  return db().transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(gameSubmissions)
      .where(eq(gameSubmissions.id, id))
      .for('update');
    if (!s) throw new HttpError(404, 'not_found', 'Submission not found.');
    if (s.status !== 'pending') throw new HttpError(409, 'already_decided', 'Already handled.');

    let gameId: string | null = null;
    if (d.decision === 'approve') {
      const taken = await tx
        .select({ id: games.id })
        .from(games)
        .where(eq(games.slug, d.slug))
        .limit(1);
      if (taken.length) throw new HttpError(409, 'slug_taken', 'That slug is already used.');
      const url = new URL(s.url);
      url.protocol = 'https:';
      const [g] = await tx
        .insert(games)
        .values({
          slug: d.slug,
          name: d.name,
          publisher: d.publisher,
          description: d.description,
          url: url.toString(),
          category: s.category as Game['category'],
          difficulty: d.difficulty,
          tier: 3,
          embedMode: 'popout',
          resetMode: 'user_local',
          resetHour: 0,
          resetNote: s.resetHint ? `Submitted as: ${s.resetHint}`.slice(0, 200) : null,
          puzzleEpoch: localDate(new Date(), 'UTC'),
          epochNumber: 1,
          numberingPublic: false,
          parserId: null,
          scoringType: 'completion',
          accentColor: d.accentColor.toUpperCase(),
          icon: d.icon,
          attributionNote: `Made and hosted by ${d.publisher}.`,
          adminEditedAt: new Date(),
        })
        .returning({ id: games.id });
      gameId = g!.id;
      await recordModAction(tx, {
        actorId,
        action: 'game.create',
        targetType: 'game',
        targetId: gameId,
        reason: `approved submission ${id}`,
        after: { slug: d.slug, name: d.name, tier: 3 },
      });
    }

    const status =
      d.decision === 'approve' ? 'approved' : d.decision === 'reject' ? 'rejected' : 'duplicate';
    await tx
      .update(gameSubmissions)
      .set({ status, reviewedBy: actorId, reviewedAt: new Date() })
      .where(eq(gameSubmissions.id, id));
    await recordModAction(tx, {
      actorId,
      action: `submission.${d.decision}`,
      targetType: 'game_submission',
      targetId: id,
      reason: d.reason,
      before: { status: 'pending' },
      after: { status, gameId },
    });
    return { gameId };
  });
}
