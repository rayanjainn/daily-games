import { expect, test } from '@playwright/test';
import { follow, played } from './support/play';
import { signInAs } from './support/session';
import { settle } from './support/shots';

// Baselines are rendered in Playwright's pinned Docker image (see .github/workflows/visual-baselines.yml).
// Other machines rasterize fonts slightly differently, so this suite only runs where VISUAL=1.
test.skip(!process.env.VISUAL, 'visual regression runs in the pinned CI image (set VISUAL=1)');

test.describe('visual regression', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`styleguide (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/styleguide');
      await settle(page);
      await expect(page).toHaveScreenshot(`styleguide-${theme}.png`, { fullPage: true });
    });

    test(`dashboard (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const user = await signInAs(page);
      await follow(page, ['wordle', 'connections', 'flagle']);
      await played(user.id, 'wordle', [0, 1, 2], { attempts: 3, maxAttempts: 6 });
      await page.goto('/today');
      await settle(page);
      await expect(page).toHaveScreenshot(`dashboard-${theme}.png`, {
        // The date, greeting (random test username) and puzzle numbers change between runs, and
        // which games are picked depends on what other test players follow.
        mask: [
          page.getByTestId('today-date'),
          page.getByRole('heading', { level: 1 }),
          page.getByTestId('puzzle-label'),
          page.getByTestId('picks').getByRole('list'),
        ],
      });
    });

    test(`catalog (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await signInAs(page);
      await page.goto('/games');
      await settle(page);
      await expect(page).toHaveScreenshot(`catalog-${theme}.png`);
    });

    test(`game page (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await signInAs(page);
      await page.goto('/games/wordle');
      await settle(page);
      // Today's puzzle number and date change daily.
      await expect(page).toHaveScreenshot(`game-page-${theme}.png`, {
        fullPage: true,
        mask: [page.locator('section[aria-labelledby="today-heading"]')],
      });
    });

    test(`sign in (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/login');
      await settle(page);
      await expect(page).toHaveScreenshot(`login-${theme}.png`, { fullPage: true });
    });

    test(`community boards (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await signInAs(page);
      await page.goto('/c');
      await settle(page);
      // Post counts and the latest activity depend on what the other tests have posted.
      await expect(page).toHaveScreenshot(`community-${theme}.png`, {
        mask: [page.locator('main')],
      });
    });

    test(`notifications (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await signInAs(page);
      await page.goto('/notifications');
      await settle(page);
      await expect(page).toHaveScreenshot(`notifications-${theme}.png`);
    });

    test(`settings (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await signInAs(page);
      await page.goto('/settings');
      await settle(page);
      // The signed-in name is random per run.
      await expect(page).toHaveScreenshot(`settings-${theme}.png`, {
        fullPage: true,
        mask: [page.getByRole('heading', { level: 1 }).locator('xpath=following-sibling::p')],
      });
    });
  }
});
