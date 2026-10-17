import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/fixtures';
import { played } from './support/play';
import { signInAs } from './support/session';

test.describe('game stats', () => {
  test('shows an empty state before any results', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/wordle');
    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByRole('heading', { name: 'No results yet' })).toBeVisible();
  });

  test('summarizes streaks, distribution, heatmap and history', async ({ page }) => {
    const user = await signInAs(page);
    // Today 3/6, then 4, X, 4, 2 on the four days before; a gap; two older wins.
    await played(user.id, 'wordle', [0], { attempts: 3, maxAttempts: 6 });
    await played(user.id, 'wordle', [1, 3], { attempts: 4, maxAttempts: 6 });
    await played(user.id, 'wordle', [2], { solved: false, maxAttempts: 6 });
    await played(user.id, 'wordle', [4], { attempts: 2, maxAttempts: 6 });
    await played(user.id, 'wordle', [10, 11], { attempts: 5, maxAttempts: 6 });
    await page.goto('/games/wordle');
    const stats = page.getByRole('region', { name: 'Your stats' });

    await expect(stats.getByTestId('stat-streak')).toHaveText('5');
    await expect(stats).toContainText('day streak · best 5');
    await expect(stats.getByTestId('stat-played')).toContainText('7');
    await expect(stats.getByTestId('stat-solve-rate')).toContainText('86%');
    await expect(stats.getByTestId('stat-best')).toContainText('2');
    await expect(stats.getByTestId('stat-average')).toContainText('3.8');
    await expect(stats.getByTestId('stat-win-streak')).toContainText('2');

    const bars = stats.getByTestId('distribution').getByRole('listitem');
    await expect(bars).toHaveCount(7);
    await expect(bars.nth(1)).toContainText('2');
    await expect(bars.nth(2)).toContainText('(today)');
    await expect(bars.nth(3)).toContainText('2'); // two 4/6
    await expect(bars.nth(6)).toContainText('X');

    const heat = stats.getByTestId('heatmap');
    await expect(heat.locator('[data-state="solved"]')).toHaveCount(6);
    await expect(heat.locator('[data-state="failed"]')).toHaveCount(1);

    const history = stats.getByTestId('history').getByRole('listitem');
    await expect(history).toHaveCount(7);
    await expect(history.first()).toContainText('3/6');
    await expect(history.nth(2)).toContainText('X/6');
  });

  test('uses times and lower-is-better for timed games', async ({ page }) => {
    const user = await signInAs(page);
    await played(user.id, 'nyt-mini', [1], { timeSeconds: 95 });
    await played(user.id, 'nyt-mini', [2], { timeSeconds: 41 });
    await played(user.id, 'nyt-mini', [3], { timeSeconds: 63 });
    await page.goto('/games/nyt-mini');
    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByTestId('stat-best')).toContainText('0:41');
    await expect(stats.getByTestId('stat-average')).toContainText('1:06');
    await expect(stats.getByRole('figure').first()).toContainText('Score spread');
  });

  test('check-off games show streaks and the calendar only', async ({ page }) => {
    const user = await signInAs(page);
    await played(user.id, 'tradle', [0, 1, 2], { source: 'checkbox' });
    await page.goto('/games/tradle');
    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByTestId('stat-streak')).toHaveText('3');
    await expect(stats.getByTestId('distribution')).toHaveCount(0);
    await expect(stats.getByTestId('stat-solve-rate')).toHaveCount(0);
    await expect(stats.getByTestId('history')).toContainText('Checked off');
  });

  test('logging a result updates the stats', async ({ page }) => {
    const user = await signInAs(page);
    await played(user.id, 'tradle', [1, 2], { source: 'checkbox' });
    await page.goto('/games/tradle');
    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByTestId('stat-streak')).toHaveText('2');
    await page.getByRole('button', { name: 'Mark today done' }).click();
    await expect(page.getByTestId('log-success')).toContainText('3 days in a row');
    await expect(stats.getByTestId('stat-streak')).toHaveText('3');
  });

  test('a long history never makes the page scroll sideways on a phone', async ({ page }) => {
    const user = await signInAs(page);
    await played(
      user.id,
      'wordle',
      Array.from({ length: 120 }, (_, i) => i),
      {
        attempts: 4,
        maxAttempts: 6,
      },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/wordle');
    await expect(page.getByTestId('heatmap')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });

  test('stats have no detectable accessibility violations', async ({ page }) => {
    const user = await signInAs(page);
    await played(user.id, 'wordle', [0, 1, 2, 5], { attempts: 4, maxAttempts: 6 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/games/wordle');
      const results = await new AxeBuilder({ page }).include('#stats-heading').analyze();
      expect(results.violations, scheme).toEqual([]);
      const all = await new AxeBuilder({ page }).analyze();
      expect(all.violations, `${scheme} page`).toEqual([]);
    }
  });
});
