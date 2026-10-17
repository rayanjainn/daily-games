import { expect, test } from '@playwright/test';
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
  }
});
