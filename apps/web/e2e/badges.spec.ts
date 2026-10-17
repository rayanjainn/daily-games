import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/fixtures';
import { follow, played } from './support/play';
import { signInAs } from './support/session';

test.describe('badges', () => {
  test('milestones come from your results and are linked from Today', async ({ page }) => {
    const u = await signInAs(page);
    await follow(page, ['wordle']);
    // Eight days of Wordle in a row (one failed), two days of the Mini, one catch-up.
    await played(u.id, 'wordle', [0, 1, 2, 3, 4, 5, 6], { attempts: 4, maxAttempts: 6 });
    await played(u.id, 'wordle', [7], { solved: false, maxAttempts: 6 });
    await played(u.id, 'nyt-mini', [0, 1], { timeSeconds: 60 });
    await played(u.id, 'tradle', [20], { source: 'checkbox', fromArchive: true });

    await page.goto('/today');
    await page.getByRole('link', { name: /Badges/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Badges' })).toBeVisible();

    const badge = (id: string) => page.locator(`[data-badge="${id}"]`);
    await expect(badge('logged')).toHaveAttribute('data-earned', '2');
    await expect(badge('logged')).toContainText('Puzzles logged: 11');
    await expect(badge('logged')).toContainText('39 to go for 50');
    await expect(badge('solved')).toContainText('Puzzles solved: 10');
    await expect(badge('daily-streak')).toContainText('Longest daily streak: 8');
    await expect(badge('daily-streak')).toHaveAttribute('data-earned', '2');
    await expect(badge('explorer')).toContainText('Different games played: 3');
    await expect(badge('catch-up')).toHaveAttribute('data-earned', '1');
    await expect(page.getByText('8 of 24 milestones reached')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('a new player has none yet', async ({ page }) => {
    await signInAs(page);
    await page.goto('/badges');
    await expect(page.getByText('0 of 24 milestones reached')).toBeVisible();
    await expect(page.locator('[data-badge="logged"]')).toContainText('1 to go for 1');
  });
});
