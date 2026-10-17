import { test, type Page } from '@playwright/test';
import { THEMES, VIEWPORTS, capture, shotsDir } from './support/shots';

/**
 * Review captures for the current branch. Run with:
 *   SHOTS_DIR=../../docs/screenshots/<branch> pnpm exec playwright test --project screenshots
 * Each entry: route + optional setup to put the page into a given state.
 */
const SCREENS: {
  name: string;
  path: string;
  setup?: (page: Page) => Promise<void>;
}[] = [
  { name: 'styleguide', path: '/styleguide' },
  {
    name: 'styleguide-dialog',
    path: '/styleguide',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Open dialog' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    name: 'styleguide-toasts',
    path: '/styleguide',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Success toast' }).click();
      await page.getByRole('button', { name: 'Error toast' }).click();
    },
  },
];

test.skip(!shotsDir(), 'set SHOTS_DIR to capture review screenshots');

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      test(`${screen.name} · ${vp.name} · ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(screen.path);
        if (screen.setup) await screen.setup(page);
        const overlay = screen.name.endsWith('dialog') || screen.name.endsWith('toasts');
        await capture(page, `${screen.name}--${vp.name}--${theme}`, { fullPage: !overlay });
      });
    }
  }
}
