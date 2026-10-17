import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { gameHealthChecks, gameReports, games, modActions } from '../db/schema';
import { loadGames } from '../registry/loader';
import { seedGames } from '../registry/seed';
import { testDb, truncateAll } from '../test/db';
import { createHealthStore, runHealthChecks } from './health';

const { db, client } = testDb();
afterAll(() => client.end());
beforeEach(() => truncateAll(db));

const two = loadGames().filter((g) => ['wordle', 'tradle'].includes(g.spec.slug));
const failing = (url: string) =>
  Promise.resolve(
    url.includes('oec.world')
      ? { ok: false, status: 503, finalUrl: url, xFrameOptions: null, csp: null, error: null }
      : { ok: true, status: 200, finalUrl: url, xFrameOptions: 'DENY', csp: null, error: null },
  );

describe('health store', () => {
  it('carries the failure count across runs and files one automatic report', async () => {
    await seedGames(db, two);
    const store = createHealthStore(db);
    const run = (day: number) =>
      runHealthChecks({
        store,
        checkPage: failing,
        embedderOrigin: 'https://everydaily.raycode.tech',
        now: new Date(Date.UTC(2026, 9, day, 4, 17)),
      });

    expect((await run(1)).down).toEqual([]);
    expect((await run(2)).down).toEqual([]);
    expect((await run(3)).down).toEqual(['tradle']);
    await run(4);

    const [tradle] = await db.select().from(games).where(eq(games.slug, 'tradle'));
    expect(tradle!.status).toBe('possibly_down');
    const checks = await db
      .select()
      .from(gameHealthChecks)
      .where(eq(gameHealthChecks.gameId, tradle!.id));
    expect(checks.map((c) => c.consecutiveFailures).sort()).toEqual([1, 2, 3, 4]);
    const reports = await db.select().from(gameReports).where(eq(gameReports.kind, 'auto'));
    expect(reports).toHaveLength(1);
    expect(reports[0]!.details).toContain('503');
    const audit = await db.select().from(modActions).where(eq(modActions.action, 'game.health'));
    expect(audit).toMatchObject([{ actorId: null, after: { status: 'possibly_down' } }]);

    // A good check brings it back.
    const back = await runHealthChecks({
      store,
      checkPage: (url) =>
        Promise.resolve({
          ok: true,
          status: 200,
          finalUrl: url,
          xFrameOptions: null,
          csp: null,
          error: null,
        }),
      embedderOrigin: 'https://everydaily.raycode.tech',
    });
    expect(back.recovered).toEqual(['tradle']);
    const [after] = await db.select().from(games).where(eq(games.slug, 'tradle'));
    expect(after!.status).toBe('active');
  });

  it('skips archived games', async () => {
    await seedGames(db, two);
    await db.update(games).set({ status: 'archived' }).where(eq(games.slug, 'tradle'));
    const list = await createHealthStore(db).listGames();
    expect(list.map((g) => g.slug)).toEqual(['wordle']);
  });
});
