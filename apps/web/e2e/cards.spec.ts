import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './support/fixtures';
import { follow, played } from './support/play';
import { signInAs } from './support/session';

/** Set CARDS_DIR to also keep the rendered PNGs for review. */
function keep(name: string, body: Buffer) {
  const dir = process.env.CARDS_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.png`, body);
}

const size = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

test.describe('stat cards', () => {
  test('the week poster and a game card render as private PNGs', async ({ page }) => {
    const u = await signInAs(page);
    await follow(page, ['wordle', 'connections', 'tradle']);
    await played(u.id, 'wordle', [0, 1, 2, 4, 5], { attempts: 4, maxAttempts: 6 });
    await played(u.id, 'wordle', [3], { solved: false, maxAttempts: 6 });
    await played(u.id, 'connections', [0, 2, 3], { attempts: 4, maxAttempts: 4 });
    await played(u.id, 'tradle', [1, 6], { source: 'checkbox' });

    const week = await page.request.get('/api/cards/week');
    expect(week.status()).toBe(200);
    expect(week.headers()['content-type']).toBe('image/png');
    expect(week.headers()['cache-control']).toContain('private');
    const weekPng = await week.body();
    expect(size(weekPng)).toEqual([1080, 1350]);
    keep('week-poster', weekPng);

    const card = await page.request.get('/api/cards/game/wordle');
    expect(card.status()).toBe(200);
    const cardPng = await card.body();
    expect(size(cardPng)).toEqual([1200, 630]);
    keep('game-card-wordle', cardPng);

    const tradle = await page.request.get('/api/cards/game/tradle');
    keep('game-card-tradle', await tradle.body());

    await page.goto('/recap');
    const img = page.getByTestId('share-image');
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1080);
    await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      /\.png$/,
    );
  });

  test('needs a session, and unknown games are 404', async ({ page, browser }) => {
    const anon = await browser.newContext();
    const res = await anon.request.get(
      new URL('/api/cards/week', test.info().project.use.baseURL).toString(),
    );
    expect(res.status()).toBe(401);
    await anon.close();
    await signInAs(page);
    expect((await page.request.get('/api/cards/game/not-a-game')).status()).toBe(404);
  });

  test('the month poster renders this month and last, and refuses other months', async ({
    page,
  }) => {
    const u = await signInAs(page);
    await played(u.id, 'wordle', [0, 1, 2, 3, 40], { attempts: 3, maxAttempts: 6 });
    await played(u.id, 'connections', [0, 2], { attempts: 4, maxAttempts: 4 });
    await played(u.id, 'tradle', [1], { source: 'checkbox', fromArchive: true });

    const month = await page.request.get('/api/cards/month');
    expect(month.status()).toBe(200);
    expect(month.headers()['cache-control']).toContain('private');
    const png = await month.body();
    expect(size(png)).toEqual([1080, 1350]);
    keep('month-poster', png);

    const now = new Date();
    const ym = (d: Date) => d.toISOString().slice(0, 7);
    const last = ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)));
    const lastRes = await page.request.get(`/api/cards/month?month=${last}`);
    expect(lastRes.status()).toBe(200);
    keep('month-poster-last', await lastRes.body());
    const next = ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15)));
    for (const bad of [next, '2026-13', 'october', '1999-01'])
      expect((await page.request.get(`/api/cards/month?month=${bad}`)).status()).toBe(404);

    await page.goto('/recap');
    // Any month in the last two years can be picked, not only this and last month.
    const old = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 15));
    await page.getByLabel('Other month').selectOption(ym(old));
    await expect(page).toHaveURL(new RegExp(`month=${ym(old)}`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      String(old.getUTCFullYear()),
    );
    await expect(page.getByTestId('share-image')).toHaveAttribute('src', /month=/);
    await page.goto('/recap');
    await page.getByRole('link', { name: 'This month' }).click();
    await expect(page.getByRole('link', { name: 'This month' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const img = page.getByTestId('share-image');
    await expect(img).toHaveAttribute('src', /\/api\/cards\/month\?month=\d{4}-\d{2}/);
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1080);
  });

  test('every card also comes in a dark style', async ({ page }) => {
    const u = await signInAs(page);
    await follow(page, ['wordle']);
    await played(u.id, 'wordle', [0, 1, 2], { attempts: 4, maxAttempts: 6 });
    for (const [path, w, h, name] of [
      ['/api/cards/week?theme=dark', 1080, 1350, 'week-poster-dark'],
      ['/api/cards/month?theme=dark', 1080, 1350, 'month-poster-dark'],
      ['/api/cards/game/wordle?theme=dark', 1200, 630, 'game-card-wordle-dark'],
    ] as const) {
      const res = await page.request.get(path);
      expect(res.status()).toBe(200);
      const png = await res.body();
      expect(size(png)).toEqual([w, h]);
      keep(name, png);
    }
    // Unknown styles fall back to light.
    const light = await (await page.request.get('/api/cards/week')).body();
    const odd = await (await page.request.get('/api/cards/week?theme=neon')).body();
    expect(odd.equals(light)).toBe(true);

    await page.goto('/recap');
    const img = page.getByTestId('share-image');
    await expect(img).not.toHaveAttribute('src', /theme=dark/);
    await page.getByRole('button', { name: 'Dark card' }).click();
    await expect(img).toHaveAttribute('src', '/api/cards/week?theme=dark');
    await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      /-dark\.png$/,
    );
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1080);
  });
});
