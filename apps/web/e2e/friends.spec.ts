import AxeBuilder from '@axe-core/playwright';
import type { Browser } from '@playwright/test';
import { apiPost } from './support/auth';
import { expect, test } from './support/fixtures';
import { played } from './support/play';
import { signInAs } from './support/session';

async function second(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = await signInAs(page);
  return { ctx, page, user };
}

test.describe('friends', () => {
  test('request, accept and compare head to head', async ({ page, browser }) => {
    const me = await signInAs(page);
    const them = await second(browser);
    await page.goto('/friends');
    await page.getByLabel('Player name').fill(them.user.username);
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByTestId('outgoing')).toContainText(them.user.username);

    await them.page.goto('/friends');
    await them.page.getByRole('button', { name: `Accept ${me.username}` }).click();
    await expect(them.page.getByTestId('friends')).toContainText(me.username);

    // Wordle: I win #-2 (3 vs 5), they win #-1 (2 vs 4); today only they have played.
    await played(me.id, 'wordle', [2], { attempts: 3, maxAttempts: 6 });
    await played(them.user.id, 'wordle', [2], { attempts: 5, maxAttempts: 6 });
    await played(me.id, 'wordle', [1], { attempts: 4, maxAttempts: 6 });
    await played(them.user.id, 'wordle', [1], { attempts: 2, maxAttempts: 6 });
    await played(them.user.id, 'wordle', [0], { attempts: 3, maxAttempts: 6 });

    await page.goto('/friends');
    await expect(page.getByTestId('friends')).toContainText('Played 1 today');
    // The friends board: spoiler-safe hides their score until I log today's Wordle.
    await expect(page.getByTestId('board-hidden')).toBeVisible();
    await expect(page.getByTestId('today-board')).not.toContainText('3/6');
    await page.getByRole('link', { name: `Compare with ${them.user.username}` }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      `You vs ${them.user.username}`,
    );
    const totals = page.getByTestId('h2h-totals');
    await expect(totals).toContainText('Your wins1');
    await expect(totals).toContainText(`${them.user.username}'s wins1`);
    // Spoiler-safe (the default): their result for today stays hidden until I log mine.
    const today = page.getByTestId('h2h-today').first();
    await expect(today).toContainText('Log yours to see');
    await expect(today).not.toContainText('3/6');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await played(me.id, 'wordle', [0], { attempts: 4, maxAttempts: 6 });
    await page.reload();
    await expect(page.getByTestId('h2h-today').first()).toContainText('3/6');

    await page.goto('/friends?game=wordle');
    const rows = page.getByTestId('today-board').getByRole('listitem');
    await expect(rows.first()).toContainText(them.user.username);
    await expect(rows.first()).toContainText('3/6');
    await expect(rows.nth(1)).toContainText(`${me.username} (you)`);
    await expect(page.getByTestId('week-board')).toContainText('3 solved · 3 played');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await them.ctx.close();
  });

  test('a mutual request becomes a friendship; strangers and blocks get no access', async ({
    page,
    browser,
  }) => {
    const me = await signInAs(page);
    const them = await second(browser);
    await page.goto('/friends');
    await them.page.goto('/friends');
    expect((await apiPost(page, '/api/friends', { username: them.user.username })).status()).toBe(
      200,
    );
    const back = await apiPost(them.page, '/api/friends', { username: me.username });
    expect((await back.json()).status).toBe('accepted');

    // A stranger can't open the comparison.
    const stranger = await second(browser);
    const res = await stranger.page.goto(`/friends/${me.username}`);
    expect(res?.status()).toBe(404);

    // Blocking ends the friendship and looks like a missing player to them.
    await page.goto(`/friends/${them.user.username}`);
    await page.getByRole('button', { name: 'Block' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Block' }).click();
    await expect(page).toHaveURL(/\/friends$/);
    const again = await apiPost(them.page, '/api/friends', { username: me.username });
    expect(again.status()).toBe(404);
    expect((await again.json()).error.message).toBe('No player with that name.');
    await them.ctx.close();
    await stranger.ctx.close();
  });

  test('rejects yourself and unknown names', async ({ page }) => {
    const me = await signInAs(page);
    await page.goto('/friends');
    expect((await apiPost(page, '/api/friends', { username: me.username })).status()).toBe(422);
    expect((await apiPost(page, '/api/friends', { username: 'nobody_here_42' })).status()).toBe(
      404,
    );
  });
});
