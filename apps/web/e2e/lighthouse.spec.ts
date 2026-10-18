import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { E2E_PORT } from './support/env';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

/**
 * Lighthouse on the main pages of a production build, in a real Chromium the test drives over the
 * debugging port. Scores here are optimistic next to a phone on a slow network (the server is
 * next door), so the limits catch regressions rather than promise field speed. Reports (HTML) go
 * to apps/web/lighthouse-reports.
 */
const PORT = 9341;
const PAGES = [
  { name: 'landing', path: '/', signedIn: false, perf: 0.85 },
  { name: 'sign-in', path: '/login', signedIn: false, perf: 0.85 },
  { name: 'catalog', path: '/games', signedIn: true, perf: 0.8 },
  { name: 'today', path: '/today', signedIn: true, perf: 0.8 },
  { name: 'rankings', path: '/rankings', signedIn: true, perf: 0.8 },
] as const;

test('Lighthouse scores on the main pages', async () => {
  const { default: lighthouse } = await import('lighthouse');
  const dir = mkdtempSync(join(tmpdir(), 'lh-profile-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless: true,
    args: [`--remote-debugging-port=${PORT}`],
  });
  const reports = join(process.cwd(), 'lighthouse-reports');
  mkdirSync(reports, { recursive: true });
  try {
    const page = await ctx.newPage();
    await signInAs(page);
    const summary: string[] = [];
    for (const p of PAGES) {
      // Signed-out audits borrow the same browser, so clear the cookie for them.
      if (!p.signedIn) await ctx.clearCookies();
      else if ((await ctx.cookies()).length === 0) await signInAs(page);
      const run = await lighthouse(
        `http://localhost:${E2E_PORT}${p.path}`,
        { port: PORT, output: 'html', logLevel: 'error' },
        {
          extends: 'lighthouse:default',
          settings: {
            onlyCategories: ['performance', 'accessibility', 'best-practices'],
            // Real production chromium is headless here; keep the default mobile emulation.
          },
        },
      );
      const lhr = run!.lhr;
      writeFileSync(join(reports, `${p.name}.html`), run!.report as string);
      const score = (id: string) => lhr.categories[id]!.score ?? 0;
      summary.push(
        `${p.name}: performance ${Math.round(score('performance') * 100)}, accessibility ${Math.round(score('accessibility') * 100)}, best practices ${Math.round(score('best-practices') * 100)}`,
      );
      expect.soft(score('accessibility'), `${p.name} accessibility`).toBeGreaterThanOrEqual(0.95);
      expect.soft(score('best-practices'), `${p.name} best practices`).toBeGreaterThanOrEqual(0.9);
      expect.soft(score('performance'), `${p.name} performance`).toBeGreaterThanOrEqual(p.perf);
    }
    console.log(`\n${summary.join('\n')}\n`);
  } finally {
    await ctx.close();
  }
});
