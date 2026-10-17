import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

export const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

export const THEMES = ['light', 'dark'] as const;

/** Output dir for review screenshots, e.g. docs/screenshots/feat-design-tokens. */
export function shotsDir(): string | null {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return null;
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Waits for fonts and settles animations so captures are stable. */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

export async function capture(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  const dir = shotsDir();
  if (!dir) return;
  await settle(page);
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: opts.fullPage ?? true });
}
