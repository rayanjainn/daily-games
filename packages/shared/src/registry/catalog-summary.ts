/**
 * Compact, client-safe view of the catalog (no share samples, no reset internals), generated
 * from the YAML by `pnpm catalog:summary` and checked for drift in tests.
 */
import type { GameSpec } from './spec';
import summary from './catalog-summary.json';

export interface CatalogSummaryEntry {
  slug: string;
  name: string;
  publisher: string;
  category: GameSpec['category'];
  tier: GameSpec['tier'];
  icon: GameSpec['icon'];
  accentColor: string;
}

export function toSummary(specs: GameSpec[]): CatalogSummaryEntry[] {
  return specs.map((s) => ({
    slug: s.slug,
    name: s.name,
    publisher: s.publisher,
    category: s.category,
    tier: s.tier,
    icon: s.icon,
    accentColor: s.accentColor,
  }));
}

export const CATALOG_SUMMARY = summary as CatalogSummaryEntry[];
