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
});
