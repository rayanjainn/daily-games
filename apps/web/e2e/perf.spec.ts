import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

/**
 * Coarse speed guards on a production build. The limits are loose on purpose (CI machines are
 * noisy); they catch a page that becomes obviously slow or jumpy, not small drifts.
 */
async function vitals(page: Page, path: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  let bytes = 0;
  page.on('response', async (r) => {
    if (r.request().resourceType() === 'script') {
      const len = Number(r.headers()['content-length'] ?? 0);
      bytes += len || (await r.body().catch(() => Buffer.alloc(0))).length;
    }
  });
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    return { lcp: w.__lcp, cls: w.__cls };
  });
  return { ...m, scriptBytes: bytes };
}

test.describe('speed guards', () => {
  for (const [name, path, signedIn] of [
    ['the landing page', '/', false],
    ['the catalog', '/games', true],
    ['Today', '/today', true],
  ] as const) {
    test(`${name} paints quickly and does not jump`, async ({ page }) => {
      if (signedIn) await signInAs(page);
      const m = await vitals(page, path);
      test.info().annotations.push({
        type: 'vitals',
        description: `LCP ${Math.round(m.lcp)} ms, CLS ${m.cls.toFixed(3)}, scripts ${Math.round(m.scriptBytes / 1024)} KB`,
      });
      expect(m.lcp).toBeLessThan(4000);
      expect(m.cls).toBeLessThan(0.1);
      // Uncompressed script on the wire for one page; the budget script guards the build total.
      expect(m.scriptBytes).toBeLessThan(1800 * 1024);
    });
  }
});
