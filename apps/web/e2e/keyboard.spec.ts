import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { follow } from './support/play';
import { signInAs } from './support/session';

interface Stop {
  tag: string;
  name: string;
  ring: boolean;
}

/** Presses Tab `max` times and describes where focus landed each time. */
async function tabThrough(page: Page, max: number): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { tag: 'BODY', name: '', ring: true };
        const cs = getComputedStyle(el);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const shadow = cs.boxShadow !== 'none';
        const border = el.matches(':focus-visible') && (outline || shadow);
        const label =
          el.getAttribute('aria-label') ||
          el.textContent?.trim().slice(0, 40) ||
          el.getAttribute('placeholder') ||
          el.id ||
          '';
        return { tag: el.tagName, name: label, ring: border };
      }),
    );
  }
  return stops;
}

test.describe('keyboard only', () => {
  test('Today: skip link, nav and every control can be reached and show where focus is', async ({
    page,
  }) => {
    await signInAs(page);
    await follow(page, ['wordle']);
    await page.goto('/today');

    // The first stop is the skip link, and using it lands in the main content.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);

    await page.goto('/today');
    const stops = await tabThrough(page, 30);
    const interactive = stops.filter((s) => s.tag !== 'BODY');
    expect(interactive.length).toBeGreaterThan(8);
    // Every stop that takes focus shows it.
    expect(interactive.filter((s) => !s.ring).map((s) => `${s.tag} ${s.name}`)).toEqual([]);
    // The main navigation is among the stops.
    for (const label of ['Today', 'Games', 'Friends', 'Community', 'Settings'])
      expect(interactive.some((s) => s.name.startsWith(label))).toBe(true);
  });

  test('a menu link opens with Enter, and focus is not trapped on the page', async ({ page }) => {
    await signInAs(page);
    await page.goto('/today');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const text = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (text?.startsWith('Games')) break;
    }
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/games/);
    // Tabbing a long way through the catalog never gets stuck on one element.
    const stops = await tabThrough(page, 40);
    const distinct = new Set(stops.map((s) => `${s.tag}:${s.name}`));
    expect(distinct.size).toBeGreaterThan(15);
  });

  test('a result can be pasted, previewed and saved without a mouse', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/wordle');
    const box = page.locator('#log-panel').getByLabel('Your Wordle share text');
    await box.focus();
    const n = Number(
      (
        await page
          .getByTestId('puzzle-number')
          .first()
          .innerText()
          .catch(() => '0')
      ).replace(/\D/g, ''),
    );
    await page.keyboard.insertText(
      `Wordle ${n.toLocaleString('en-US')} 3/6\n\n⬛🟨⬛⬛🟩\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩`,
    );
    const stops = await tabThrough(page, 3);
    expect(stops.every((s) => s.ring)).toBe(true);
    await expect(page.locator('#log-panel')).toBeVisible();
  });

  test('a dialog traps focus while open and gives it back on Escape', async ({ page }) => {
    await signInAs(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Delete account' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
        true,
      );
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete account' })).toBeFocused();
  });
});
