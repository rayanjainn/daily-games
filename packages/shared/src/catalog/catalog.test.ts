import { describe, expect, it } from 'vitest';
import { PARSERS } from '../parsers';
import { filterCatalog, foldText, matchScore, type CatalogEntry } from './filter';
import { gameEditSchema, gameRuleIssues, gameSubmissionSchema, type RuleSubject } from './rules';

const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  slug: 'x',
  name: 'X',
  publisher: 'Someone',
  description: 'A daily game.',
  category: 'word',
  difficulty: 'medium',
  tier: 3,
  embedMode: 'popout',
  tags: [],
  ...over,
});

const GAMES = [
  entry({
    slug: 'wordle',
    name: 'Wordle',
    publisher: 'The New York Times',
    tier: 1,
    tags: ['nyt'],
  }),
  entry({ slug: 'quordle', name: 'Quordle', publisher: 'Merriam-Webster', tier: 1 }),
  entry({ slug: 'globle', name: 'Globle', category: 'geography', difficulty: 'easy', tier: 1 }),
  entry({
    slug: 'flagle',
    name: 'Flagle',
    category: 'geography',
    description: 'Guess the flag from tiles.',
  }),
  entry({
    slug: 'the-mini',
    name: 'The Mini Crossword',
    category: 'crossword',
    tier: 1,
    tags: ['nyt'],
  }),
  entry({ slug: 'cafe', name: 'Café Words', tier: 2 }),
];

describe('foldText', () => {
  it('strips accents, case and punctuation', () => {
    expect(foldText('  Café—Words!! ')).toBe('cafe words');
  });
});

describe('matchScore', () => {
  it('ranks name prefix above word prefix above metadata above description', () => {
    const w = GAMES[0]!;
    expect(matchScore(w, 'wor')).toBeGreaterThan(matchScore(GAMES[4]!, 'cross'));
    expect(matchScore(GAMES[4]!, 'cross')).toBeGreaterThan(matchScore(w, 'nyt'));
    expect(matchScore(w, 'nyt')).toBeGreaterThan(matchScore(GAMES[3]!, 'tiles'));
    expect(matchScore(w, 'zzz')).toBe(0);
  });

  it('requires every query word to match', () => {
    expect(matchScore(GAMES[4]!, 'mini nyt')).toBeGreaterThan(0);
    expect(matchScore(GAMES[4]!, 'mini geography')).toBe(0);
  });
});

describe('filterCatalog', () => {
  it('orders by tier then name without a query', () => {
    expect(filterCatalog(GAMES, {}).map((g) => g.slug)).toEqual([
      'globle',
      'quordle',
      'the-mini',
      'wordle',
      'cafe',
      'flagle',
    ]);
  });

  it('combines filters', () => {
    expect(filterCatalog(GAMES, { category: 'geography' }).map((g) => g.slug)).toEqual([
      'globle',
      'flagle',
    ]);
    expect(filterCatalog(GAMES, { category: 'geography', tier: 3 }).map((g) => g.slug)).toEqual([
      'flagle',
    ]);
    expect(filterCatalog(GAMES, { difficulty: 'easy' }).map((g) => g.slug)).toEqual(['globle']);
    expect(filterCatalog(GAMES, { embed: 'iframe' })).toEqual([]);
  });

  it('filters to followed games', () => {
    expect(
      filterCatalog(GAMES, { following: true }, new Set(['flagle', 'wordle'])).map((g) => g.slug),
    ).toEqual(['wordle', 'flagle']);
  });

  it('orders by relevance with a query and matches accents loosely', () => {
    expect(filterCatalog(GAMES, { q: 'ordle' }).map((g) => g.slug)).toEqual(['quordle', 'wordle']);
    expect(filterCatalog(GAMES, { q: 'cafe' }).map((g) => g.slug)).toEqual(['cafe']);
    expect(filterCatalog(GAMES, { q: 'nyt' }).map((g) => g.slug)).toEqual(['the-mini', 'wordle']);
  });
});

const base: RuleSubject = {
  tier: 3,
  parserId: null,
  embedMode: 'popout',
  verifiedEmbeddableAt: null,
  scoringType: 'completion',
  maxAttempts: null,
  resetMode: 'user_local',
  resetTz: null,
};
const known = new Set(Object.keys(PARSERS));

describe('gameRuleIssues', () => {
  it('accepts a tier 3 link-only game', () => {
    expect(gameRuleIssues(base, known)).toEqual([]);
  });

  it('promotes 3 → 2 only with the generic parser and a real score', () => {
    expect(gameRuleIssues({ ...base, tier: 2 }, known).map((i) => i.path)).toEqual([
      'parserId',
      'scoringType',
    ]);
    expect(
      gameRuleIssues(
        { ...base, tier: 2, parserId: 'generic', scoringType: 'attempts', maxAttempts: 6 },
        known,
      ),
    ).toEqual([]);
  });

  it('native games are tier 1 with no parser: results come from play, not pasted text', () => {
    const native = {
      ...base,
      tier: 1 as const,
      embedMode: 'native' as const,
      scoringType: 'time' as const,
    };
    expect(gameRuleIssues({ ...native, parserId: null }, known)).toEqual([]);
    expect(gameRuleIssues({ ...native, parserId: 'wordle' }, known).map((i) => i.path)).toEqual([
      'parserId',
    ]);
    expect(
      gameRuleIssues({ ...native, tier: 2, parserId: null }, known).map((i) => i.path),
    ).toContain('embedMode');
  });

  it('promotes 2 → 1 only with a dedicated, existing parser', () => {
    const t2 = { ...base, tier: 2 as const, scoringType: 'points' as const };
    expect(gameRuleIssues({ ...t2, tier: 1, parserId: 'generic' }, known)[0]?.path).toBe(
      'parserId',
    );
    expect(gameRuleIssues({ ...t2, tier: 1, parserId: 'nope' }, known)[0]?.message).toMatch(
      /no parser/,
    );
    expect(gameRuleIssues({ ...t2, tier: 1, parserId: 'globle' }, known)).toEqual([]);
  });

  it('refuses iframe without a probe and fixed resets without a zone', () => {
    expect(gameRuleIssues({ ...base, embedMode: 'iframe' }).map((i) => i.path)).toEqual([
      'embedMode',
    ]);
    expect(
      gameRuleIssues({ ...base, embedMode: 'iframe', verifiedEmbeddableAt: new Date() }),
    ).toEqual([]);
    expect(gameRuleIssues({ ...base, resetMode: 'fixed' })[0]?.path).toBe('resetTz');
    expect(gameRuleIssues({ ...base, resetTz: 'UTC' })[0]?.path).toBe('resetTz');
  });
});

const edit = {
  name: 'Flagle',
  publisher: 'Flagle',
  description: 'Guess the flag from tiles.',
  url: 'https://www.flagle.io/',
  category: 'geography',
  difficulty: 'medium',
  tier: 3,
  embedMode: 'popout',
  status: 'active',
  resetMode: 'user_local',
  resetTz: '',
  resetHour: 0,
  resetGraceHours: 0,
  resetNote: '',
  puzzleEpoch: '2022-02-21',
  epochNumber: 0,
  numberingPublic: true,
  parserId: '',
  scoringType: 'completion',
  maxAttempts: null,
  scoringUnit: '',
  accentColor: '#C2410C',
  icon: 'flag',
  attributionNote: 'Made and hosted by Flagle.',
  tags: [],
};

describe('gameEditSchema', () => {
  it('turns blank optional text into null', () => {
    const r = gameEditSchema.parse(edit);
    expect(r.resetTz).toBeNull();
    expect(r.parserId).toBeNull();
    expect(r.resetNote).toBeNull();
  });

  it('rejects unreadable accents, bad zones, http URLs and unknown fields', () => {
    expect(gameEditSchema.safeParse({ ...edit, accentColor: '#808080' }).success).toBe(false);
    expect(gameEditSchema.safeParse({ ...edit, resetTz: 'Mars/Base' }).success).toBe(false);
    expect(gameEditSchema.safeParse({ ...edit, url: 'http://flagle.io' }).success).toBe(false);
    expect(
      gameEditSchema.safeParse({ ...edit, verifiedEmbeddableAt: '2026-01-01T00:00:00Z' }).success,
    ).toBe(false);
  });
});

describe('gameSubmissionSchema', () => {
  it('accepts a minimal suggestion and rejects other schemes', () => {
    expect(
      gameSubmissionSchema.safeParse({ url: 'https://x.io/daily', name: 'X', category: 'logic' })
        .success,
    ).toBe(true);
    expect(
      gameSubmissionSchema.safeParse({ url: 'javascript:alert(1)', name: 'X', category: 'logic' })
        .success,
    ).toBe(false);
  });
});
