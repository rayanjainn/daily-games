import AxeBuilder from '@axe-core/playwright';
import { apiPost } from './support/auth';
import { expect, test, type Page } from './support/fixtures';
import { follow, played } from './support/play';
import { signInAs } from './support/session';

const num = async (page: Page, id: string) =>
  Number((await page.getByTestId(id).locator('dd').innerText()).replace(/,/g, ''));

test.describe('platform stats', () => {
  test('are for the admin only', async ({ page, browser }) => {
    await signInAs(page);
    expect((await page.goto('/admin/stats'))?.status()).toBe(404);

    const mod = await (await browser.newContext()).newPage();
    await signInAs(mod, { role: 'mod' });
    expect((await mod.goto('/admin/stats'))?.status()).toBe(404);
    await mod.goto('/admin');
    await expect(mod.getByRole('link', { name: 'Platform stats' })).toHaveCount(0);
  });

  test('show people, play and community numbers that move with activity', async ({ page }) => {
    const admin = await signInAs(page, { role: 'admin' });
    await page.goto('/admin/stats');
    const before = {
      results: await num(page, 'stat-results'),
      posters: await num(page, 'stat-posters'),
    };
    expect(await num(page, 'stat-online')).toBeGreaterThanOrEqual(1);
    expect(await num(page, 'stat-total')).toBeGreaterThanOrEqual(1);

    await follow(page, ['wordle']);
    await played(admin.id, 'wordle', [0, 1], { attempts: 3, maxAttempts: 6 });
    expect(
      (
        await apiPost(page, '/api/c/everydaily/posts', { title: 'Stats post', body: 'hi' })
      ).status(),
    ).toBe(200);

    await page.goto('/admin/stats');
    expect(await num(page, 'stat-results')).toBe(before.results + 2);
    expect(await num(page, 'stat-posters')).toBeGreaterThanOrEqual(before.posters + 1);
    await expect(page.getByTestId('by-source')).toContainText('paste');

    const wordle = page.getByTestId('game-row').filter({ hasText: 'Wordle' }).first();
    await expect(wordle).toBeVisible();
    await expect(page.getByTestId('daily-table').locator('tbody tr')).toHaveCount(14);
    await expect(page.getByTestId('boards-table')).toContainText('EveryDaily');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // The nav shows the link, and it is the current page.
    await expect(page.getByRole('link', { name: 'Platform stats' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
