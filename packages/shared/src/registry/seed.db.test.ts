import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { games, modActions } from '../db/schema';
import { testDb, truncateAll } from '../test/db';
import { currentPuzzle } from '../time/puzzle';
import { clockFromGame } from './clock';
import { loadGames, type LoadedGame } from './loader';
import { seedGames } from './seed';

const { db, client } = testDb();
afterAll(() => client.end());
beforeEach(() => truncateAll(db));

const catalog = loadGames();
const withHash = (
  g: LoadedGame,
  hash: string,
  patch: Partial<LoadedGame['spec']> = {},
): LoadedGame => ({
  ...g,
  hash,
  spec: { ...g.spec, ...patch },
});

describe('seedGames', () => {
  it('inserts the whole catalog, then is idempotent', async () => {
    const first = await seedGames(db, catalog);
    expect(first.inserted).toHaveLength(catalog.length);
    const second = await seedGames(db, catalog);
    expect(second.inserted).toHaveLength(0);
    expect(second.updated).toHaveLength(0);
    expect(second.unchanged).toHaveLength(catalog.length);
    expect(await db.select().from(games)).toHaveLength(catalog.length);
  });

  it('applies YAML changes', async () => {
    const wordle = catalog.find((g) => g.spec.slug === 'wordle')!;
    await seedGames(db, [wordle]);
    const report = await seedGames(db, [
      withHash(wordle, 'changed', { description: 'Updated description text.' }),
    ]);
    expect(report.updated).toEqual(['wordle']);
    const [row] = await db.select().from(games).where(eq(games.slug, 'wordle'));
    expect(row!.description).toBe('Updated description text.');
  });

  it('keeps moderator edits while YAML is unchanged, and audits when YAML overrides them', async () => {
    const globle = catalog.find((g) => g.spec.slug === 'globle')!;
    await seedGames(db, [globle]);
    await db
      .update(games)
      .set({ name: 'Globle (edited)', adminEditedAt: new Date() })
      .where(eq(games.slug, 'globle'));

    await seedGames(db, [globle]);
    expect((await db.select().from(games).where(eq(games.slug, 'globle')))[0]!.name).toBe(
      'Globle (edited)',
    );

    const report = await seedGames(db, [withHash(globle, 'new-hash')]);
    expect(report.overridden).toEqual(['globle']);
    expect((await db.select().from(games).where(eq(games.slug, 'globle')))[0]!.name).toBe('Globle');
    const audit = await db.select().from(modActions);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('game.yaml_override');
  });

  it('reports but never touches DB-only games', async () => {
    const [wordle, connections] = [
      catalog.find((g) => g.spec.slug === 'wordle')!,
      catalog.find((g) => g.spec.slug === 'connections')!,
    ];
    await seedGames(db, [wordle, connections]);
    const report = await seedGames(db, [wordle]);
    expect(report.dbOnly).toEqual(['connections']);
    expect(await db.select().from(games)).toHaveLength(2);
  });

  it('stores rows whose puzzle clock matches the YAML', async () => {
    await seedGames(db, catalog);
    const now = new Date('2026-10-17T15:00:00Z');
    for (const slug of ['wordle', 'connections', 'strands', 'quordle', 'worldle']) {
      const [row] = await db.select().from(games).where(eq(games.slug, slug));
      const spec = catalog.find((g) => g.spec.slug === slug)!.spec;
      expect(currentPuzzle(clockFromGame(row!), now, 'UTC'), slug).toEqual(
        currentPuzzle({ reset: spec.reset, numbering: spec.numbering }, now, 'UTC'),
      );
    }
    const [wordle] = await db.select().from(games).where(eq(games.slug, 'wordle'));
    expect(currentPuzzle(clockFromGame(wordle!), now, 'UTC').number).toBe(1946);
  });
});
