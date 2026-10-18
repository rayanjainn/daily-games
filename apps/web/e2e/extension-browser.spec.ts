import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

const repo = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

async function todayNumber(slug: string): Promise<number> {
  const sql = e2eSql();
  const [r] = await sql`
    SELECT epoch_number + ((now() AT TIME ZONE 'UTC')::date - puzzle_epoch) AS n
    FROM games WHERE slug = ${slug}`;
  await sql.end();
  return Number(r!.n);
}

const GAME_PAGE = (share: string) => `<!doctype html><title>Fake game</title>
<button id="share">Share</button>
<script>
  document.getElementById('share').addEventListener('click', () => {
    navigator.clipboard.writeText(${JSON.stringify(share)}).catch(() => {});
  });
</script>`;

test.describe('browser extension in Chromium', () => {
  test.skip(Boolean(process.env.E2E_NO_EXTENSION), 'extension run disabled');

  test('sharing on a game page saves the result through the extension', async ({
    page,
    baseURL,
  }) => {
    execFileSync('pnpm', ['exec', 'tsx', 'scripts/build-extension.ts', '--dev'], {
      cwd: repo,
      stdio: 'ignore',
    });
    const user = await signInAs(page);
    await page.goto('/settings');
    const { token } = (await (
      await apiPost(page, '/api/me/capture-tokens', { label: 'Playwright' })
    ).json()) as { token: string };

    const n = await todayNumber('wordle');
    const share = `Wordle ${n.toLocaleString('en-US')} 3/6\n\n⬛🟨⬛⬛🟩\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩`;

    const dir = mkdtempSync(join(tmpdir(), 'ext-profile-'));
    const extPath = join(repo, 'apps/extension/dist');
    const ctx = await chromium.launchPersistentContext(dir, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
    });
    try {
      let [worker] = ctx.serviceWorkers();
      worker ??= await ctx.waitForEvent('serviceworker');
      await worker.evaluate(([appUrl, t]) => chrome.storage.local.set({ appUrl, token: t }), [
        baseURL!,
        token,
      ] as const);

      // A page on a "game site" (localhost is watched in dev builds) copies a share text.
      await ctx.route('http://localhost:9/**', (r) =>
        r.fulfill({ contentType: 'text/html', body: GAME_PAGE(share) }),
      );
      const game = await ctx.newPage();
      await game.goto('http://localhost:9/play');
      await game.getByRole('button', { name: 'Share' }).click();

      await expect
        .poll(
          async () => {
            const sql = e2eSql();
            const rows = await sql`SELECT source FROM results WHERE user_id = ${user.id}`;
            await sql.end();
            return rows.map((r) => r.source);
          },
          { timeout: 15000 },
        )
        .toEqual(['extension']);

      const last = await worker.evaluate(() => chrome.storage.local.get('last'));
      expect(last.last.kind).toBe('saved');

      // Copying something that isn't a result sends nothing.
      await game.evaluate(() => navigator.clipboard.writeText('just a word').catch(() => {}));
      await game.waitForTimeout(500);
      const sql = e2eSql();
      const rows = await sql`SELECT 1 FROM results WHERE user_id = ${user.id}`;
      await sql.end();
      expect(rows).toHaveLength(1);
    } finally {
      await ctx.close();
    }
  });
});
