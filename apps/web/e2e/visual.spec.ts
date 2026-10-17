import { expect, test } from '@playwright/test';
import { settle } from './support/shots';

test.describe('visual regression', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`styleguide (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/styleguide');
      await settle(page);
      await expect(page).toHaveScreenshot(`styleguide-${theme}.png`, { fullPage: true });
    });
  }
});
