import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { follow, played } from './support/play';
import { signInAs } from './support/session';

const row = (page: Page, name: string) => page.getByTestId('ranking-row').filter({ hasText: name });

test.describe('rankings', () => {
  test('verified and all-games boards count different results', async ({ page }) => {
    const me = await signInAs(page);
    await follow(page, ['wordle', 'cipher']);
    await played(me.id, 'wordle', [0, 1, 2], { attempts: 3, maxAttempts: 6 });
    await played(me.id, 'cipher', [0], { attempts: 2, maxAttempts: 8, source: 'native' });

    await page.goto('/rankings');
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();
    // Only the native result counts as verified: 2 of 8 guesses is 94 points.
    await expect(row(page, me.username)).toContainText('94 pts');
    await expect(row(page, me.username)).toContainText('1 solved · 1 played');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByRole('link', { name: 'All games' }).click();
    await expect(page.getByRole('link', { name: 'All games' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Three Wordle solves in 3 of 6 (84 each) plus the Cipher game.
    await expect(row(page, me.username)).toContainText(`${3 * 84 + 94} pts`);
    await expect(page.getByText(/Self-reported/)).toBeVisible();
  });

  test('catch-ups score nothing, and hidden players only see themselves', async ({
    page,
    browser,
  }) => {
    const hidden = await signInAs(page);
    await follow(page, ['wordle']);
    await played(hidden.id, 'wordle', [0], { attempts: 2, maxAttempts: 6 });
    await played(hidden.id, 'wordle', [1], { attempts: 2, maxAttempts: 6, fromArchive: true });
    const sql = e2eSql();
    await sql`UPDATE users SET show_on_rankings = false WHERE id = ${hidden.id}`;
    await sql.end();

    await page.goto('/rankings?scope=all');
    // 2 of 6 is 92 points; the catch-up adds nothing.
    await expect(row(page, hidden.username)).toContainText('92 pts');
    await expect(row(page, hidden.username)).toContainText('You');

    const other = await (await browser.newContext()).newPage();
    await signInAs(other);
    await other.goto('/rankings?scope=all');
    await expect(row(other, hidden.username)).toHaveCount(0);
  });

  test('an empty week says so and Today links to the page', async ({ page }) => {
    await signInAs(page);
    await page.goto('/today');
    await page
      .getByRole('link', { name: /Rankings/ })
      .first()
      .click();
    await page.waitForURL(/\/rankings/);
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();
  });
});
