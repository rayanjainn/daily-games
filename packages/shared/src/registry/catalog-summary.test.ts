import { describe, expect, it } from 'vitest';
import { CATALOG_SUMMARY, toSummary } from './catalog-summary';
import { loadGames } from './loader';

describe('catalog summary', () => {
  it('matches the YAML (run `pnpm catalog:summary` after editing games)', () => {
    expect(CATALOG_SUMMARY).toEqual(toSummary(loadGames().map((g) => g.spec)));
  });
});
