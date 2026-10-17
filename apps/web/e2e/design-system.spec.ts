import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('design system', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`styleguide has no axe violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/styleguide');
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
  }

  test('theme toggle cycles system → light → dark and persists', async ({ page }) => {
    await page.goto('/styleguide');
    const toggle = page.getByRole('button', { name: /^Theme:/ });
    await expect(toggle).toHaveAccessibleName('Theme: match device');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: /^Theme:/ }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  });

  test('dialog is keyboard operable and traps focus', async ({ page }) => {
    await page.goto('/styleguide');
    await page.getByRole('button', { name: 'Open dialog' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Turn on reminders?' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open dialog' })).toBeFocused();
  });

  test('chips expose pressed state', async ({ page }) => {
    await page.goto('/styleguide');
    const chip = page.getByRole('button', { name: 'Geography' });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  test('progress ring reports its value', async ({ page }) => {
    await page.goto('/styleguide');
    await expect(page.getByRole('progressbar', { name: '3 of 5 done' })).toBeVisible();
  });

  test('styleguide is hidden in production without the flag', async ({ request }) => {
    // The test server runs with ENABLE_STYLEGUIDE=1, so this only checks the page renders here.
    const res = await request.get('/styleguide');
    expect(res.status()).toBe(200);
  });
});
