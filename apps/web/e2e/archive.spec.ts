import AxeBuilder from '@axe-core/playwright';
import { apiPost } from './support/auth';
import { expect, test } from './support/fixtures';
import { played } from './support/play';
import { signInAs } from './support/session';

test.describe('archive tracker', () => {
  test('is hidden until the player has started a game', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/tradle');
    await expect(page.getByRole('region', { name: 'Your stats' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Catch up' })).toHaveCount(0);
  });

  test('logs a missed check-off day without repairing the streak', async ({ page }) => {
    const user = await signInAs(page);
    await played(user.id, 'tradle', [1, 3], { source: 'checkbox' });
    await page.goto('/games/tradle');
    const tracker = page.getByRole('region', { name: 'Catch up' });
    await expect(tracker).toContainText('You played 2 of the last 3 puzzles');
    const missed = tracker.getByTestId('missed-days').getByRole('listitem');
    await expect(missed).toHaveCount(1);

    await missed.getByRole('button', { name: /^Log / }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Play it from the archive on');
    await dialog.getByRole('button', { name: /^Mark .* done$/ }).click();
    await expect(dialog.getByTestId('log-success')).toContainText('Caught up: Done');
    await expect(dialog.getByTestId('log-success')).toContainText('Streaks only count');
    await page.keyboard.press('Escape');

    await expect(tracker).toContainText('All caught up on the last 3 puzzles');
    await expect(tracker.getByTestId('missed-days')).toHaveCount(0);
    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByTestId('stat-streak')).toHaveText('1');
    await expect(stats.getByTestId('stat-played')).toContainText('3');
    await expect(stats.getByTestId('history')).toContainText('Archive · Checked off');
  });

  test('enters a score for a missed day', async ({ page }) => {
    const user = await signInAs(page);
    await played(user.id, 'wordle', [0, 1, 3], { attempts: 3, maxAttempts: 6 });
    await page.goto('/games/wordle');
    const tracker = page.getByRole('region', { name: 'Catch up' });
    await tracker.getByRole('button', { name: /^Log #/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Enter score' }).click();
    await dialog.getByLabel('Guesses').selectOption('4');
    await dialog.getByRole('button', { name: 'Save result' }).click();
    await expect(dialog.getByTestId('log-success')).toContainText('Caught up: 4/6');
    await page.keyboard.press('Escape');

    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByTestId('stat-streak')).toHaveText('2');
    await expect(stats.getByTestId('stat-played')).toContainText('4');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("refuses a catch-up for today's puzzle", async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/tradle');
    const res = await apiPost(page, '/api/results', {
      source: 'checkbox',
      slug: 'tradle',
      fromArchive: true,
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.code).toBe('not_archive');
  });
});
