/**
 * Loads and validates catalog YAML. Node only (uses fs).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { normalizeGameUrl } from './normalize';
import { gameSpecSchema, type GameSpec } from './spec';

export const GAMES_DIR = fileURLToPath(new URL('../../games', import.meta.url));

export interface LoadedGame {
  spec: GameSpec;
  file: string;
  /** sha256 of the raw YAML, stored on the DB row to detect admin edits vs. YAML changes. */
  hash: string;
}

export class CatalogError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Catalog has ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
}

export function loadGames(dir: string = GAMES_DIR): LoadedGame[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort();
  const problems: string[] = [];
  const games: LoadedGame[] = [];
  const seenSlugs = new Map<string, string>();
  const seenUrls = new Map<string, string>();

  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8');
    let data: unknown;
    try {
      data = parse(raw);
    } catch (err) {
      problems.push(`${file}: invalid YAML (${(err as Error).message})`);
      continue;
    }
    const res = gameSpecSchema.safeParse(data);
    if (!res.success) {
      for (const issue of res.error.issues) {
        problems.push(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    const spec = res.data;
    if (basename(file, '.yaml') !== spec.slug) {
      problems.push(`${file}: file name must match slug "${spec.slug}"`);
    }
    const dupSlug = seenSlugs.get(spec.slug);
    if (dupSlug) problems.push(`${file}: slug "${spec.slug}" already used by ${dupSlug}`);
    const urlKey = normalizeGameUrl(spec.url);
    const dupUrl = seenUrls.get(urlKey);
    if (dupUrl) problems.push(`${file}: URL duplicates ${dupUrl}`);
    seenSlugs.set(spec.slug, file);
    seenUrls.set(urlKey, file);
    games.push({ spec, file, hash: createHash('sha256').update(raw).digest('hex') });
  }

  if (problems.length) throw new CatalogError(problems);
  return games;
}
