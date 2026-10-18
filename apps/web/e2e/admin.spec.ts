import AxeBuilder from '@axe-core/playwright';
import { apiPost, csrfHeaders } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test, type Page } from './support/fixtures';
import { signInAs } from './support/session';

async function q<T = Record<string, unknown>>(
  fn: (sql: ReturnType<typeof e2eSql>) => Promise<T[]>,
): Promise<T[]> {
  const sql = e2eSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** A throwaway Tier 3 game so edits never disturb other specs running in parallel. */
async function scratchGame(): Promise<string> {
  const slug = `scratch-${Math.random().toString(36).slice(2, 8)}`;
  await q(
    (
      sql,
    ) => sql`INSERT INTO games (id, slug, name, publisher, description, url, category, difficulty, tier,
      reset_mode, puzzle_epoch, epoch_number, scoring_type, accent_color, icon, attribution_note)
      VALUES (gen_random_uuid(), ${slug}, 'Scratch Game', 'Scratch Co', 'A daily puzzle for tests.',
      ${`https://example.com/${slug}`}, 'logic', 'medium', 3, 'user_local', '2025-01-01', 1,
      'completion', '#4361EE', 'brain', 'Made and hosted by Scratch Co.')`,
  );
  return slug;
}

const actions = (targetId: string) =>
  q<{ action: string; after: Record<string, unknown> }>(
    (sql) =>
      sql`SELECT action, after FROM mod_actions WHERE target_id = ${targetId} ORDER BY created_at`,
  );

async function suggest(page: Page, url: string, name = 'Tiny Daily') {
  return apiPost(page, '/api/submissions', { url, name, category: 'logic' });
}

test.describe('moderation access', () => {
  test('players get a 404 page and 403 APIs', async ({ page }) => {
    await signInAs(page);
    expect((await page.goto('/admin'))?.status()).toBe(404);
    expect((await page.goto('/admin/games/wordle'))?.status()).toBe(404);
    await page.goto('/games');
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

    const edit = await page.request.patch('/api/admin/games/wordle', {
      data: {},
      headers: await csrfHeaders(page),
    });
    expect(edit.status()).toBe(400); // schema first, then role: no data leaks either way
    const report = await apiPost(page, '/api/admin/reports/00000000-0000-0000-0000-000000000000', {
      status: 'resolved',
    });
    expect(report.status()).toBe(403);
  });

  test('suggestions are closed to players while the flag is admin-only', async ({ page }) => {
    await signInAs(page);
    expect((await page.goto('/games/suggest'))?.status()).toBe(404);
    await page.goto('/games');
    await expect(page.getByRole('link', { name: 'Suggest a game' })).toHaveCount(0);
    const res = await suggest(page, 'https://example.org/daily');
    expect(res.status()).toBe(403);
  });
});

test.describe('moderation', () => {
  test('resolves a player report and logs it', async ({ page, browser }) => {
    const slug = await scratchGame();
    const player = await browser.newContext();
    const playerPage = await player.newPage();
    await signInAs(playerPage);
    await playerPage.goto(`/games/${slug}`);
    const reported = await apiPost(playerPage, `/api/games/${slug}/report`, {
      kind: 'moved',
      details: 'Lives at a new address now.',
    });
    expect(reported.status()).toBe(200);
    await player.close();

    await signInAs(page, { role: 'mod' });
    await page.goto('/admin');
    const row = page.getByRole('listitem').filter({ hasText: 'Lives at a new address now.' });
    await expect(row).toContainText('Scratch Game');
    await row.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByText('Marked resolved')).toBeVisible();
    await expect(row).toHaveCount(0);

    const [rep] = await q<{ id: string; status: string }>(
      (sql) =>
        sql`SELECT r.id, r.status FROM game_reports r JOIN games g ON g.id = r.game_id WHERE g.slug = ${slug}`,
    );
    expect(rep!.status).toBe('resolved');
    expect((await actions(rep!.id)).map((a) => a.action)).toEqual(['report.resolve']);

    await page.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByText('report.resolve').first()).toBeVisible();
  });

  test('promotes a game from tier 3 to 2 only when the rules are met', async ({ page }) => {
    const slug = await scratchGame();
    await signInAs(page, { role: 'mod' });
    await page.goto('/admin/games');
    await page.getByLabel('Filter games').fill(slug);
    await page.getByRole('link', { name: /Scratch Game/ }).click();
    await page.waitForURL(`**/admin/games/${slug}`);

    await page.getByLabel('Description').fill('A daily logic puzzle with a score.');
    await page.getByLabel('Tier', { exact: true }).selectOption('2');
    const issues = page.getByTestId('rule-issues');
    await expect(issues).toContainText('tier 2 needs a parser');
    await expect(issues).toContainText('record a score');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await page.getByLabel('Parser').selectOption('generic');
    await page.getByLabel('Scoring').selectOption('points');
    await expect(issues).toBeHidden();
    // Playing inside EveryDaily stays off until the embed probe passes.
    await expect(
      page.getByLabel('Where it plays').locator('option[value="iframe"]'),
    ).toBeDisabled();
    await page.getByLabel('Reason for the change (optional)').fill('Share text has a score');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    const [g] = await q<{ id: string; tier: number; parser_id: string; admin_edited_at: Date }>(
      (sql) => sql`SELECT id, tier, parser_id, admin_edited_at FROM games WHERE slug = ${slug}`,
    );
    expect(g).toMatchObject({ tier: 2, parser_id: 'generic' });
    expect(g!.admin_edited_at).toBeTruthy();
    const logged = await actions(g!.id);
    expect(logged.map((a) => a.action)).toEqual(['game.tier']);
    expect(logged[0]!.after).toMatchObject({ tier: 2, parserId: 'generic', scoringType: 'points' });
    const entry = page.getByRole('region', { name: 'History' }).getByRole('listitem').first();
    await expect(entry).toContainText('game.tier');
    for (const field of ['description', 'tier', 'parserId', 'scoringType'])
      await expect(entry).toContainText(field);
    await expect(entry).toContainText('Share text has a score');
  });

  test('the API refuses edits that break the rules', async ({ page }) => {
    const slug = await scratchGame();
    await signInAs(page, { role: 'admin' });
    await page.goto(`/admin/games/${slug}`);
    const base = {
      name: 'Scratch Game',
      publisher: 'Scratch Co',
      description: 'A daily puzzle for tests.',
      url: `https://example.com/${slug}`,
      category: 'logic',
      difficulty: 'medium',
      tier: 3,
      embedMode: 'popout',
      status: 'active',
      resetMode: 'user_local',
      resetTz: '',
      resetHour: 0,
      resetGraceHours: 0,
      resetNote: '',
      puzzleEpoch: '2025-01-01',
      epochNumber: 1,
      numberingPublic: false,
      parserId: '',
      scoringType: 'completion',
      maxAttempts: null,
      scoringUnit: '',
      accentColor: '#4361EE',
      icon: 'brain',
      attributionNote: 'Made and hosted by Scratch Co.',
      tags: [],
    };
    const patch = (body: unknown) =>
      csrfHeaders(page).then((headers) =>
        page.request.patch(`/api/admin/games/${slug}`, { data: body, headers }),
      );
    const iframe = await patch({ ...base, embedMode: 'iframe' });
    expect(iframe.status()).toBe(400);
    expect(((await iframe.json()) as { error: { message: string } }).error.message).toMatch(
      /embed probe/,
    );
    expect(
      (await patch({ ...base, tier: 1, parserId: 'generic', scoringType: 'points' })).status(),
    ).toBe(400);
    expect(
      (await patch({ ...base, verifiedEmbeddableAt: new Date().toISOString() })).status(),
    ).toBe(400);
    expect((await patch({ ...base, accentColor: '#808080' })).status()).toBe(400);
    const same = await patch(base);
    expect(await same.json()).toEqual({ changed: false });
    expect((await patch({ ...base, status: 'archived' })).status()).toBe(200);
    await page.goto('/games');
    expect((await page.goto(`/games/${slug}`))?.status()).toBe(404);
  });

  test('suggests a game, blocks private addresses and approves it into the catalog', async ({
    page,
  }) => {
    await signInAs(page, { role: 'mod' });
    await page.goto('/games');
    await page.getByRole('link', { name: 'Suggest a game' }).click();
    await page.waitForURL('**/games/suggest');

    // Already listed: points to the existing page instead.
    await page
      .getByLabel('Game address')
      .fill('https://WWW.nytimes.com/games/wordle/index.html?x=1');
    await page.getByLabel('Name').fill('Wordle');
    await page.getByLabel('Category').selectOption('word');
    await page.getByRole('button', { name: 'Send suggestion' }).click();
    await expect(page.getByRole('heading', { name: 'Already here!' })).toBeVisible();

    // A local address is accepted for review, but never fetched.
    const unique = Math.random().toString(36).slice(2, 8);
    await page.goto('/games/suggest');
    await page.getByRole('button', { name: 'Send suggestion' }).click();
    await expect(page.getByText('Paste the full address, starting with https://')).toBeVisible();
    await page.getByLabel('Game address').fill(`http://localhost/${unique}`);
    await page.getByLabel('Name').fill(`Tiny ${unique}`);
    await page.getByLabel('Category').selectOption('logic');
    await page.getByLabel(/When does a new puzzle/).fill('midnight local');
    await page.getByRole('button', { name: 'Send suggestion' }).click();
    await expect(page.getByRole('heading', { name: 'Thanks for the tip' })).toBeVisible();

    const [sub] = await q<{ id: string; probe_result: { error?: string } }>(
      (sql) =>
        sql`SELECT id, probe_result FROM game_submissions WHERE normalized_key = ${`localhost/${unique}`}`,
    );
    expect(sub!.probe_result.error).toBe('blocked address');
    const dup = await suggest(page, `http://localhost/${unique}/`);
    expect(dup.status()).toBe(409);

    await page.goto('/admin');
    const card = page.getByTestId('submission').filter({ hasText: `Tiny ${unique}` });
    await expect(card).toContainText('Fetch failed: blocked address');
    await card.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Slug')).toHaveValue(`tiny-${unique}`);
    await dialog.getByLabel('Publisher').fill('Tiny Games');
    await dialog.getByLabel('Short description').fill('A tiny logic puzzle every day.');
    await dialog.getByRole('button', { name: 'Add game' }).click();
    await expect(page.getByText(`Tiny ${unique} added as a check-off game`)).toBeVisible();

    await page.goto(`/games/tiny-${unique}`);
    await expect(page.getByRole('heading', { level: 1, name: `Tiny ${unique}` })).toBeVisible();
    await expect(page.getByText('Check-off', { exact: true })).toBeVisible();
    await expect(page.getByTestId('attribution')).toContainText("isn't affiliated with Tiny Games");

    const logged = await actions(sub!.id);
    expect(logged.map((a) => a.action)).toEqual(['submission.approve']);
  });

  test('moderation screens have no detectable accessibility violations', async ({ page }) => {
    const slug = await scratchGame();
    await signInAs(page, { role: 'mod' });
    for (const path of [
      '/admin',
      '/admin/games',
      `/admin/games/${slug}`,
      '/admin/audit',
      '/games/suggest',
    ]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, path).toEqual([]);
    }
  });

  test('a moderator can try a share text on a game’s parser without logging anything', async ({
    page,
  }) => {
    const me = await signInAs(page, { role: 'mod' });
    const sql = e2eSql();
    const [r] = await sql`
      SELECT epoch_number + ((now() AT TIME ZONE 'UTC')::date - puzzle_epoch) AS n
      FROM games WHERE slug = 'wordle'`;
    await sql.end();
    const n = Number(r!.n).toLocaleString('en-US');
    await page.goto('/admin/games/wordle');
    const check = page.getByTestId('share-check');
    await check.getByLabel('Try a share text').fill('this is not a share');
    await check.getByRole('button', { name: 'Check' }).click();
    await expect(check.getByTestId('share-check-result')).not.toContainText('Reads as');

    await check
      .getByLabel('Try a share text')
      .fill(`Wordle ${n} 3/6\n\n⬛🟨⬛⬛🟩\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩`);
    await check.getByRole('button', { name: 'Check' }).click();
    await expect(check.getByTestId('share-check-result')).toContainText('Reads as solved: 3/6');

    const q = e2eSql();
    const rows = await q`SELECT 1 FROM results WHERE user_id = ${me.id}`;
    await q.end();
    expect(rows).toHaveLength(0);
  });
});
