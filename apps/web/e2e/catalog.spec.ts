import AxeBuilder from '@axe-core/playwright';
import { apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test, type Page } from './support/fixtures';
import { signInAs } from './support/session';

async function gameId(slug: string) {
  const sql = e2eSql();
  const [row] = await sql`SELECT id FROM games WHERE slug = ${slug}`;
  await sql.end();
  return row!.id as string;
}

async function follows(userId: string) {
  const sql = e2eSql();
  const rows =
    await sql`SELECT g.slug FROM follows f JOIN games g ON g.id = f.game_id WHERE f.user_id = ${userId} ORDER BY f.position`;
  await sql.end();
  return rows.map((r) => r.slug as string);
}

const cards = (page: Page) => page.getByTestId('game-card');

test.describe('catalog', () => {
  test('requires a session', async ({ page }) => {
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
    await page.goto('/games');
    await page.waitForURL(/\/login\?next=%2Fgames/);
  });

  test('searches and filters, keeping filters in the address', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games');
    const total = await cards(page).count();
    expect(total).toBeGreaterThanOrEqual(60);

    await page.getByLabel('Search games').fill('ordle');
    await expect(cards(page).first()).toContainText(/ordle/i);
    const ordles = await cards(page).count();
    expect(ordles).toBeLessThan(total);
    for (const text of await cards(page).locator('h3').allInnerTexts())
      expect(text.toLowerCase()).toContain('ordle');
    await expect(page).toHaveURL(/\?q=ordle/);

    await page.getByLabel('Search games').fill('');
    // The query is debounced; wait until it has really cleared before counting.
    await expect(page).not.toHaveURL(/[?&]q=/);
    await page
      .getByRole('group', { name: 'Category' })
      .getByRole('button', { name: /Geography/ })
      .click();
    await page.getByLabel('Difficulty').selectOption('easy');
    await expect(page).toHaveURL(/category=geography/);
    await expect(page).toHaveURL(/difficulty=easy/);
    const geo = await cards(page).count();
    expect(geo).toBeGreaterThan(0);
    expect(geo).toBeLessThan(total);

    // Reloading keeps the filters.
    await page.reload();
    await expect(page.getByLabel('Difficulty')).toHaveValue('easy');
    await expect(
      page.getByRole('group', { name: 'Category' }).getByRole('button', { name: /Geography/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page)).toHaveCount(geo);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    // Other specs may add games in parallel, so "all" means at least what we saw.
    await expect.poll(() => cards(page).count()).toBeGreaterThanOrEqual(total);

    await page.getByLabel('Search games').fill('zzzz no such game');
    await expect(page.getByText('No games match')).toBeVisible();
    await page.getByRole('button', { name: 'Show all games' }).click();
    await expect.poll(() => cards(page).count()).toBeGreaterThanOrEqual(total);
  });

  test('filters by tracking tier', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games?tier=1');
    await expect(page.getByLabel('Tracking')).toHaveValue('1');
    const n = await cards(page).count();
    expect(n).toBeGreaterThanOrEqual(9);
    await expect(cards(page).filter({ hasNotText: 'Full stats' })).toHaveCount(0);
  });

  test('follows and unfollows from the catalog', async ({ page }) => {
    const user = await signInAs(page);
    await page.goto('/games?q=wordle');
    await page.getByRole('button', { name: 'Follow Wordle' }).click();
    await expect(page.getByRole('button', { name: 'Following Wordle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(() => follows(user.id)).toEqual(['wordle']);

    await page.goto('/games?q=globle');
    await page.getByRole('button', { name: 'Follow Globle' }).click();
    await expect.poll(() => follows(user.id)).toEqual(['wordle', 'globle']);

    await page.goto('/games?following=1');
    await expect(cards(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Following Wordle' }).click();
    await expect.poll(() => follows(user.id)).toEqual(['globle']);
    await page.reload();
    await expect(cards(page)).toHaveCount(1);
  });

  test('shows a designed empty state when nothing is followed', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games?following=1');
    await expect(page.getByText('Nothing followed yet')).toBeVisible();
  });

  test('game page shows today, reset time, attribution and a safe play link', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games');
    await page.getByRole('link', { name: 'Wordle', exact: true }).click();
    await page.waitForURL('**/games/wordle');
    await expect(page.getByRole('heading', { level: 1, name: 'Wordle' })).toBeVisible();
    await expect(page.getByTestId('today-puzzle')).toHaveText(/^#\d{1,3}(,\d{3})*$/);
    await expect(page.getByText('New puzzle at midnight, your time.')).toBeVisible();
    await expect(page.getByTestId('attribution')).toHaveText(
      "Made by The New York Times. EveryDaily isn't affiliated with The New York Times; we just help you keep track.",
    );
    // Play opens a popout from the click (see results.spec); the site link is a plain, safe link.
    await expect(page.getByRole('button', { name: /Play on nytimes\.com/ })).toBeVisible();
    const site = page.getByRole('link', { name: 'nytimes.com', exact: true });
    await expect(site).toHaveAttribute('href', 'https://www.nytimes.com/games/wordle/index.html');
    await expect(site).toHaveAttribute('target', '_blank');
    await expect(site).toHaveAttribute('rel', 'noopener noreferrer');

    await page.getByRole('button', { name: /Follow\s+Wordle/ }).click();
    await expect(page.getByRole('button', { name: /Following\s+Wordle/ })).toBeVisible();
  });

  test('converts fixed-zone resets to the player clock', async ({ page }) => {
    await signInAs(page, { timezone: 'Asia/Kolkata' });
    await page.goto('/games/nyt-mini');
    await expect(
      page.getByText(
        /New puzzle at 10 PM the evening before, New York time\. That's \d{1,2}:30 AM where you are\./,
      ),
    ).toBeVisible();
  });

  test('unknown and archived games are not found', async ({ page }) => {
    await signInAs(page);
    const res = await page.goto('/games/no-such-game');
    expect(res?.status()).toBe(404);
    const sql = e2eSql();
    await sql`INSERT INTO games (id, slug, name, publisher, description, url, category, difficulty, tier,
      reset_mode, puzzle_epoch, epoch_number, scoring_type, accent_color, icon, attribution_note, status)
      VALUES (gen_random_uuid(), 'old-gone-game', 'Old Gone', 'Someone', 'An archived daily game.',
      'https://example.com/gone', 'word', 'easy', 3, 'user_local', '2024-01-01', 1, 'completion',
      '#4361EE', 'grid', 'Made and hosted by Someone.', 'archived') ON CONFLICT DO NOTHING`;
    await sql.end();
    expect((await page.goto('/games/old-gone-game'))?.status()).toBe(404);
    await page.goto('/games?q=old%20gone');
    await expect(page.getByText('No games match')).toBeVisible();
  });

  test('reports a problem once per kind', async ({ page }) => {
    const user = await signInAs(page);
    await page.goto('/games/flagle');
    await page.getByRole('button', { name: 'Report a problem' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Pick what is wrong.');
    await dialog.getByLabel(/Something else/).check();
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Tell us a little about the problem.');

    await dialog.getByLabel(/Wrong reset time/).check();
    await dialog.getByLabel('Details (optional)').fill('Now changes at 6 AM UTC.');
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('Thanks, report sent')).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Report a problem' }).click();
    await page
      .getByRole('dialog')
      .getByLabel(/Wrong reset time/)
      .check();
    await page.getByRole('dialog').getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('You already reported this')).toBeVisible();

    const sql = e2eSql();
    const rows =
      await sql`SELECT kind, details, status FROM game_reports WHERE user_id = ${user.id}`;
    await sql.end();
    expect(rows).toEqual([
      { kind: 'wrong_reset', details: 'Now changes at 6 AM UTC.', status: 'open' },
    ]);
  });

  test('APIs validate input, CSRF and sessions', async ({ page, request }) => {
    await signInAs(page);
    await page.goto('/games');
    const wordle = await gameId('wordle');

    expect(
      (await apiPost(page, '/api/follows/00000000-0000-0000-0000-000000000000', {})).status(),
    ).toBe(404);
    expect((await apiPost(page, '/api/follows/not-a-uuid', {})).status()).toBe(404);
    const noCsrf = await page.request.post(`/api/follows/${wordle}`, {
      data: {},
      headers: { origin: new URL(page.url()).origin },
    });
    expect(noCsrf.status()).toBe(403);
    expect((await apiPost(page, '/api/games/wordle/report', { kind: 'auto' })).status()).toBe(400);
    expect(
      (
        await apiPost(page, '/api/games/wordle/report', { kind: 'dead', details: 'x'.repeat(1001) })
      ).status(),
    ).toBe(400);

    // Signed out: reads are public, writes are not.
    const list = await request.get('/api/games');
    expect(list.status()).toBe(200);
    const body = (await list.json()) as {
      games: { slug: string; today: { number: number | null } }[];
    };
    expect(body.games.find((g) => g.slug === 'wordle')?.today.number).toBeGreaterThan(1500);
    await page.context().clearCookies({ name: /ed_session$/ });
    expect((await apiPost(page, '/api/games/wordle/report', { kind: 'dead' })).status()).toBe(401);
    expect((await apiPost(page, `/api/follows/${wordle}`, {})).status()).toBe(401);
  });

  test('has no detectable accessibility violations', async ({ page }) => {
    await signInAs(page);
    for (const path of ['/games', '/games/wordle', '/games?following=1']) {
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, `${path} (${scheme})`).toEqual([]);
      }
    }
    await page.goto('/games/wordle');
    await page.getByRole('button', { name: 'Report a problem' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
