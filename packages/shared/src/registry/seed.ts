/**
 * Upserts catalog YAML into the games table.
 * Rules:
 *  - new slug                → insert
 *  - YAML unchanged (hash)   → leave the row alone, so moderator edits survive re-seeding
 *  - YAML changed            → YAML wins; if a moderator had edited the row, the override is
 *                              recorded in mod_actions with before/after
 * Games that exist only in the DB (approved user submissions) are never touched.
 */
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client';
import { games, modActions, type NewGame } from '../db/schema';
import type { LoadedGame } from './loader';
import type { GameSpec } from './spec';

export function specToRow(spec: GameSpec, hash: string): NewGame {
  return {
    slug: spec.slug,
    name: spec.name,
    publisher: spec.publisher,
    description: spec.description,
    url: spec.url,
    category: spec.category,
    difficulty: spec.difficulty,
    tier: spec.tier,
    embedMode: spec.embedMode,
    resetMode: spec.reset.mode,
    resetTz: spec.reset.timezone ?? null,
    resetHour: spec.reset.hour,
    resetGraceHours: spec.reset.graceHours ?? 0,
    resetNote: spec.reset.note ?? null,
    puzzleEpoch: spec.numbering.epoch,
    epochNumber: spec.numbering.epochNumber,
    numberingPublic: spec.numbering.public,
    parserId: spec.parserId,
    scoringType: spec.scoring.type,
    maxAttempts: spec.scoring.maxAttempts ?? null,
    scoringUnit: spec.scoring.unit ?? null,
    status: spec.status,
    accentColor: spec.accentColor,
    icon: spec.icon,
    attributionNote: spec.attribution,
    verifiedEmbeddableAt: spec.verifiedEmbeddableAt ? new Date(spec.verifiedEmbeddableAt) : null,
    verifiedLiveAt: spec.verifiedLiveAt ? new Date(spec.verifiedLiveAt) : null,
    tags: spec.tags,
    sourceYamlHash: hash,
  };
}

export interface SeedReport {
  inserted: string[];
  updated: string[];
  unchanged: string[];
  /** slugs where a moderator edit was overwritten by a YAML change */
  overridden: string[];
  /** slugs in the DB that no YAML file describes (left untouched) */
  dbOnly: string[];
}

export async function seedGames(db: Database, loaded: LoadedGame[]): Promise<SeedReport> {
  const report: SeedReport = {
    inserted: [],
    updated: [],
    unchanged: [],
    overridden: [],
    dbOnly: [],
  };
  const slugs = loaded.map((g) => g.spec.slug);

  await db.transaction(async (tx) => {
    const existing = slugs.length
      ? await tx.select().from(games).where(inArray(games.slug, slugs))
      : [];
    const bySlug = new Map(existing.map((g) => [g.slug, g]));

    for (const { spec, hash } of loaded) {
      const row = specToRow(spec, hash);
      const current = bySlug.get(spec.slug);
      if (!current) {
        await tx.insert(games).values(row);
        report.inserted.push(spec.slug);
        continue;
      }
      if (current.sourceYamlHash === hash) {
        report.unchanged.push(spec.slug);
        continue;
      }
      if (current.adminEditedAt) {
        await tx.insert(modActions).values({
          actorId: null,
          action: 'game.yaml_override',
          targetType: 'game',
          targetId: current.id,
          reason: 'Catalog YAML changed after a moderator edit; YAML values applied.',
          before: current,
          after: row,
        });
        report.overridden.push(spec.slug);
      }
      await tx
        .update(games)
        .set({ ...row, adminEditedAt: null })
        .where(eq(games.id, current.id));
      report.updated.push(spec.slug);
    }

    const all = await tx.select({ slug: games.slug }).from(games);
    const yamlSlugs = new Set(slugs);
    report.dbOnly = all.map((r) => r.slug).filter((s) => !yamlSlugs.has(s));
  });

  return report;
}
