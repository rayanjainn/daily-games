import AxeBuilder from '@axe-core/playwright';
import { csrfHeaders } from './support/auth';
import { follow, played } from './support/play';
import { expect, test, type Page } from './support/fixtures';
import { signInAs } from './support/session';

const rows = (page: Page) => page.getByTestId('checklist-item');

test.describe('dashboard', () => {
  test('signed-in players land on today', async ({ page }) => {
    await signInAs(page);
    await page.goto('/');
    await page.waitForURL((u) => u.pathname === '/today');
  });

  test('starts empty with popular picks to follow', async ({ page }) => {
    await signInAs(page);
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Build your daily lineup' })).toBeVisible();
    await expect(page.getByTestId('combined-streak')).toContainText('0');
    await page.getByRole('button', { name: 'Follow Wordle' }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByTestId('today-headline')).toHaveText('1 puzzle waiting for you.');
    await expect(rows(page).first()).toContainText('Wordle');
    await expect(rows(page).first().getByRole('link', { name: /Play/ })).toHaveAttribute(
      'href',
      'https://www.nytimes.com/games/wordle/index.html',
    );
  });

  test('shows progress, results and streaks', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'connections', 'flagle']);
    await played(user.id, 'wordle', [0, 1, 2], { attempts: 4, maxAttempts: 6 });
    await played(user.id, 'flagle', [1], { source: 'checkbox' });
    await page.goto('/today');

    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3');
    await expect(page.getByTestId('today-headline')).toHaveText('2 more to go. Nice start!');
    await expect(page.getByTestId('combined-streak')).toContainText('3');

    const wordle = rows(page).filter({ hasText: 'Wordle' });
    await expect(wordle).toHaveAttribute('data-done', 'true');
    await expect(wordle).toContainText('4/6');
    await expect(wordle.getByRole('img', { name: '3-day streak' })).toBeVisible();

    const flagle = rows(page).filter({ hasText: 'Flagle' });
    await expect(flagle).toHaveAttribute('data-done', 'false');
    await expect(flagle.getByRole('img', { name: /1-day streak, play today/ })).toBeVisible();
    await expect(flagle.getByRole('link', { name: /Play/ })).toBeVisible();
  });

  test('shows failures as X and celebrates a full checklist', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle']);
    await played(user.id, 'wordle', [0], { solved: false, attempts: 6, maxAttempts: 6 });
    await page.goto('/today');
    await expect(rows(page).first()).toContainText('X/6');
    await expect(page.getByTestId('today-headline')).toHaveText(
      'All done for today. See you tomorrow!',
    );
    await expect(page.getByRole('progressbar')).toContainText('All done');
  });

  test('warns when the combined streak is at risk', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'globle']);
    await played(user.id, 'globle', [1, 2, 3, 4]);
    await page.goto('/today');
    await expect(
      page.getByText('Play any one puzzle today to keep your 4-day streak.'),
    ).toBeVisible();
    await expect(page.getByTestId('combined-streak').getByRole('img')).toHaveAccessibleName(
      '4-day streak, play today to keep it',
    );
  });

  test('reorders the checklist', async ({ page }) => {
    await signInAs(page);
    await follow(page, ['wordle', 'connections', 'strands']);
    await page.goto('/today');
    const names = () => rows(page).locator('a:not([target])').allInnerTexts();
    await expect.poll(names).toEqual(['Wordle', 'Connections', 'Strands']);
    await page.getByRole('button', { name: 'Reorder' }).click();
    await expect(page.getByRole('button', { name: 'Move Wordle up' })).toBeDisabled();
    await page.getByRole('button', { name: 'Move Wordle down' }).click();
    await page.getByRole('button', { name: 'Move Strands up' }).click();
    const order = ['Connections', 'Strands', 'Wordle'];
    await expect.poll(names).toEqual(order);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.reload();
    await expect.poll(names).toEqual(order);

    // A list that does not match the player's follows is refused.
    const stale = await page.request.patch('/api/follows/order', {
      data: { gameIds: ['00000000-0000-4000-8000-000000000000'] },
      headers: await csrfHeaders(page),
    });
    expect(stale.status()).toBe(409);
  });

  test('has no detectable accessibility violations', async ({ page }) => {
    const user = await signInAs(page);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/today');
      expect((await new AxeBuilder({ page }).analyze()).violations, `empty ${scheme}`).toEqual([]);
    }
    await follow(page, ['wordle', 'flagle']);
    await played(user.id, 'wordle', [0, 1], { attempts: 3, maxAttempts: 6 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/today');
      await page.getByRole('button', { name: 'Reorder' }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations, `list ${scheme}`).toEqual([]);
    }
  });
});
