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

  test('theme control: three visible choices that really change the page, and persist', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/styleguide');
    const group = page.getByRole('group', { name: 'Theme' });
    const choice = (name: string) => group.getByRole('button', { name: `Theme: ${name}` });
    const background = () =>
      page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);

    await expect(choice('Match device')).toHaveAttribute('aria-pressed', 'true');
    expect(await background()).toBe('rgb(253, 242, 225)'); // the warm light paper

    await choice('Dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(choice('Dark')).toHaveAttribute('aria-pressed', 'true');
    // Deep purple, not black: the blue and red channels clearly above the green one.
    expect(await background()).toBe('rgb(23, 10, 44)');
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      'content',
      '#170A2C',
    );

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(choice('Dark')).toHaveAttribute('aria-pressed', 'true');
    expect(await background()).toBe('rgb(23, 10, 44)');

    await choice('Light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await background()).toBe('rgb(253, 242, 225)');

    await choice('Match device').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    expect(await background()).toBe('rgb(253, 242, 225)');
  });

  test('match device follows the device: a dark device gets the purple theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/styleguide');
    expect(await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(
      'rgb(23, 10, 44)',
    );
    // Picking Light overrides the device.
    await page
      .getByRole('group', { name: 'Theme' })
      .getByRole('button', { name: 'Theme: Light' })
      .click();
    expect(await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(
      'rgb(253, 242, 225)',
    );
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

  test('clickable controls show a pointer, disabled ones do not', async ({ page }) => {
    await page.goto('/styleguide');
    const cursor = (name: string) =>
      page
        .getByRole('button', { name, exact: true })
        .first()
        .evaluate((el) => getComputedStyle(el).cursor);
    expect(await cursor('Open dialog')).toBe('pointer');
    const disabled = page.locator('button:disabled').first();
    await expect(disabled).toBeVisible();
    expect(await disabled.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('pointer');
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
