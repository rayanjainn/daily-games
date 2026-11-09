import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { glowRoute, sixesAnswer } from './support/native';
import { signInAs } from './support/session';

async function puzzleNumber(page: Page) {
  return Number((await page.getByTestId('native-puzzle').innerText()).replace(/\D/g, ''));
}

async function savedResult(userId: string, slug: string) {
  const sql = e2eSql();
  const rows = await sql`SELECT r.solved, r.attempts, r.time_seconds, r.source FROM results r
    JOIN games g ON g.id = r.game_id WHERE r.user_id = ${userId} AND g.slug = ${slug}`;
  await sql.end();
  return rows;
}

test.describe('Sixes and Glow', () => {
  test('Sixes: a wrong grid costs a check, the right one is saved with the time', async ({
    page,
  }) => {
    const me = await signInAs(page);
    await page.goto('/games/sixes/play');
    const p = sixesAnswer(await puzzleNumber(page));
    const grid = page.getByRole('group', { name: 'Sixes grid' });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const empty = p.givens.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    // Fill every square, the first one wrongly, using the keyboard on the grid.
    for (const [k, i] of empty.entries()) {
      await grid.getByRole('button').nth(i).click();
      const digit = k === 0 ? (p.solution[i]! % 6) + 1 : p.solution[i]!;
      await grid.press(String(digit));
    }
    await page.getByRole('button', { name: 'Check grid' }).click();
    await expect(page.getByTestId('sixes-wrong')).toContainText('1 square is wrong');

    await grid.getByRole('button').nth(empty[0]!).click();
    await page.getByRole('button', { name: `Put ${p.solution[empty[0]!]}` }).click();
    await page.getByRole('button', { name: 'Check grid' }).click();
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
    await expect(page.getByTestId('native-summary')).toHaveText(/^\d+:\d{2}$/);
    expect(await savedResult(me.id, 'sixes')).toMatchObject([{ solved: true, source: 'native' }]);
  });

  test('Sixes: the givens can’t be changed and half a grid isn’t checked', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/sixes/play');
    const p = sixesAnswer(await puzzleNumber(page));
    const tampered = [...p.solution];
    const given = p.givens.findIndex(Boolean);
    tampered[given] = (tampered[given]! % 6) + 1;
    const bad = await apiPost(page, '/api/native/sixes', { action: 'grid', cells: tampered });
    expect(bad.status()).toBe(422);
    const half = await apiPost(page, '/api/native/sixes', { action: 'grid', cells: p.givens });
    expect((await half.json()).error.code).toBe('incomplete');
  });

  test('Glow: the shortest route clears the board and scores the taps', async ({ page }) => {
    const me = await signInAs(page);
    await page.goto('/games/glow/play');
    const g = glowRoute(await puzzleNumber(page));
    expect(g.route).toHaveLength(g.par);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const lights = page.getByRole('group', { name: /^Lights/ }).getByRole('button');
    await expect(lights).toHaveCount(25);
    // A wasted tap, then start over: only the final route counts.
    await lights.nth(g.route[0]!).click();
    await page.getByRole('button', { name: 'Start over' }).click();
    for (const i of g.route) await lights.nth(i).click();
    await expect(page.getByRole('heading', { name: 'Lights out!' })).toBeVisible();
    await expect(page.getByTestId('native-summary')).toHaveText(`${g.par}/30`);
    expect(await savedResult(me.id, 'glow')).toMatchObject([
      { solved: true, attempts: g.par, source: 'native' },
    ]);
  });

  test('Glow: a route that leaves lights on is refused', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/glow/play');
    const res = await apiPost(page, '/api/native/glow', { action: 'taps', taps: [0] });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.code).toBe('not_dark');
  });
});
