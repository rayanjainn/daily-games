import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { GAME_CATEGORIES } from '../domain';
import { CatalogError, GAMES_DIR, loadGames } from './loader';
import { normalizeGameUrl } from './normalize';
import { gameSpecSchema } from './spec';

describe('catalog YAML', () => {
  const games = loadGames();

  it('loads and validates every game', () => {
    expect(games.length).toBeGreaterThanOrEqual(60);
  });

  it('covers every category', () => {
    const used = new Set(games.map((g) => g.spec.category));
    for (const c of GAME_CATEGORIES) expect(used, c).toContain(c);
  });

  it('has at least eight tier 1 games and a tier 2 set', () => {
    expect(games.filter((g) => g.spec.tier === 1).length).toBeGreaterThanOrEqual(8);
    expect(games.filter((g) => g.spec.tier === 2).length).toBeGreaterThan(0);
  });

  it('never claims iframe embedding without a probe record', () => {
    for (const g of games) {
      if (g.spec.embedMode === 'iframe')
        expect(g.spec.verifiedEmbeddableAt, g.spec.slug).not.toBeNull();
    }
  });

  it('records a live check for every game', () => {
    for (const g of games) expect(g.spec.verifiedLiveAt, g.spec.slug).not.toBeNull();
  });

  it('gives every game a distinct accent color within its category', () => {
    const seen = new Map<string, string>();
    for (const g of games) {
      const key = `${g.spec.category}:${g.spec.accentColor.toLowerCase()}`;
      expect(seen.get(key), `${g.spec.slug} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, g.spec.slug);
    }
  });
});

describe('catalog validation', () => {
  const base = parse(readFileSync(join(GAMES_DIR, 'wordle.yaml'), 'utf8')) as Record<
    string,
    unknown
  >;

  it.each([
    ['iframe without a probe', { embedMode: 'iframe' }],
    ['fixed reset without timezone', { reset: { mode: 'fixed', hour: 0 } }],
    ['unknown timezone', { reset: { mode: 'fixed', timezone: 'Mars/Base', hour: 0 } }],
    ['tier 1 without a parser', { parserId: null }],
    ['tier 1 with the generic parser', { parserId: 'generic' }],
    ['tier 3 with a parser', { tier: 3, scoring: { type: 'completion' } }],
    ['attempts without max', { scoring: { type: 'attempts' } }],
    ['http url', { url: 'http://example.com' }],
    ['bad slug', { slug: 'Bad Slug' }],
    ['unknown key', { secretField: true }],
    ['bad color', { accentColor: 'green' }],
    ['unknown icon', { icon: 'nyt-logo' }],
    ['no samples on tier 1', { shareTextSamples: [] }],
  ])('rejects %s', (_label, patch) => {
    expect(gameSpecSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it('reports duplicate URLs and file/slug mismatches together', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-'));
    const write = (file: string, patch: Record<string, unknown>) =>
      writeFileSync(join(dir, file), JSON.stringify({ ...base, ...patch }));
    write('wordle.yaml', {});
    write('wordle-copy.yaml', { slug: 'wordle-copy', url: 'https://nytimes.com/games/wordle/' });
    write('other.yaml', { slug: 'not-other', url: 'https://example.com/other' });
    try {
      loadGames(dir);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CatalogError);
      const msg = (err as CatalogError).problems.join('\n');
      // Files load alphabetically, so the later file (wordle.yaml) is the one reported.
      expect(msg).toContain('wordle.yaml: URL duplicates wordle-copy.yaml');
      expect(msg).toContain('other.yaml: file name must match slug "not-other"');
    }
  });
});

describe('normalizeGameUrl', () => {
  it.each([
    ['https://www.nytimes.com/games/wordle/index.html', 'nytimes.com/games/wordle'],
    ['https://NYTimes.com/games/wordle/', 'nytimes.com/games/wordle'],
    ['http://www.nytimes.com/games/wordle?ref=x#top', 'nytimes.com/games/wordle'],
    ['https://globle-game.com', 'globle-game.com'],
    ['https://globle-game.com:443/', 'globle-game.com'],
  ])('%s → %s', (input, out) => {
    expect(normalizeGameUrl(input)).toBe(out);
  });

  it('rejects non-web schemes', () => {
    expect(() => normalizeGameUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeGameUrl('ftp://example.com')).toThrow();
  });
});
