import type { Difficulty, EmbedMode, GameCategory, Tier } from '../domain';

/** The fields catalog search and filters look at. */
export interface CatalogEntry {
  slug: string;
  name: string;
  publisher: string;
  description: string;
  category: GameCategory;
  difficulty: Difficulty;
  tier: Tier;
  embedMode: EmbedMode;
  tags: string[];
}

export interface CatalogFilter {
  q?: string;
  category?: GameCategory | null;
  difficulty?: Difficulty | null;
  tier?: Tier | null;
  embed?: EmbedMode | null;
  /** only games the player follows */
  following?: boolean;
}

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function foldText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Relevance of `entry` for a query: 0 means no match. Every query word must match somewhere;
 * name prefix beats name word beats publisher/tags beats description.
 */
export function matchScore(entry: CatalogEntry, q: string): number {
  const words = foldText(q).split(' ').filter(Boolean);
  if (words.length === 0) return 1;
  const name = foldText(entry.name);
  const nameWords = name.split(' ');
  const meta = foldText([entry.publisher, entry.category, ...entry.tags].join(' '));
  const desc = foldText(entry.description);
  let total = 0;
  for (const w of words) {
    let s = 0;
    if (name.startsWith(w)) s = 8;
    else if (nameWords.some((nw) => nw.startsWith(w))) s = 6;
    else if (name.replace(/ /g, '').includes(w)) s = 4;
    else if (meta.split(' ').some((m) => m.startsWith(w))) s = 3;
    else if (desc.split(' ').some((d) => d.startsWith(w))) s = 1;
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

/**
 * Applies filters and the search query. With a query, results are ordered by relevance (ties
 * by tier, then name); without one, by tier then name.
 */
export function filterCatalog<T extends CatalogEntry>(
  entries: readonly T[],
  f: CatalogFilter,
  followed: ReadonlySet<string> = new Set(),
): T[] {
  const scored: { e: T; s: number }[] = [];
  for (const e of entries) {
    if (f.category && e.category !== f.category) continue;
    if (f.difficulty && e.difficulty !== f.difficulty) continue;
    if (f.tier && e.tier !== f.tier) continue;
    if (f.embed && e.embedMode !== f.embed) continue;
    if (f.following && !followed.has(e.slug)) continue;
    const s = f.q ? matchScore(e, f.q) : 1;
    if (s > 0) scored.push({ e, s });
  }
  return scored
    .sort((a, b) => b.s - a.s || a.e.tier - b.e.tier || a.e.name.localeCompare(b.e.name))
    .map((x) => x.e);
}
