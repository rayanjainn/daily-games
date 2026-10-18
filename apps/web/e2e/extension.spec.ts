import { apiPost, apiSend } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test, type Page } from './support/fixtures';
import { signInAs } from './support/session';

async function todayNumber(slug: string): Promise<number> {
  const sql = e2eSql();
  const [r] = await sql`
    SELECT epoch_number + ((now() AT TIME ZONE 'UTC')::date - puzzle_epoch) AS n
    FROM games WHERE slug = ${slug}`;
  await sql.end();
  return Number(r!.n);
}

function wordleShare(n: number) {
  return `Wordle ${n.toLocaleString('en-US')} 3/6\n\n⬛🟨⬛⬛🟩\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩`;
}

async function makeToken(page: Page, label = 'Test browser') {
  const res = await apiPost(page, '/api/me/capture-tokens', { label });
  expect(res.status()).toBe(200);
  return (await res.json()) as { id: string; token: string };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

test.describe('browser extension API', () => {
  test('a token saves a captured result once and only for its owner', async ({
    page,
    playwright,
  }) => {
    const user = await signInAs(page);
    await page.goto('/settings');
    const { token } = await makeToken(page);
    expect(token).toMatch(/^edx_/);

    // No cookies from here on: the extension has only the bearer token.
    const ext = await playwright.request.newContext({ baseURL: page.url().split('/settings')[0] });
    const n = await todayNumber('wordle');

    const ping = await ext.get('/api/extension/ping', { headers: bearer(token) });
    expect(ping.status()).toBe(200);
    expect((await ping.json()).username).toBe(user.username);

    const first = await ext.post('/api/extension/capture', {
      headers: bearer(token),
      data: {
        shareText: wordleShare(n),
        pageUrl: 'https://www.nytimes.com/games/wordle/index.html',
      },
    });
    expect(first.status()).toBe(200);
    const saved = await first.json();
    expect(saved.game.slug).toBe('wordle');
    expect(saved.summary).toBe('3/6');

    const sql = e2eSql();
    const rows = await sql`SELECT source FROM results WHERE user_id = ${user.id}`;
    await sql.end();
    expect(rows.map((r) => r.source)).toEqual(['extension']);

    const again = await ext.post('/api/extension/capture', {
      headers: bearer(token),
      data: { shareText: wordleShare(n) },
    });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe('duplicate');

    const unknown = await ext.post('/api/extension/capture', {
      headers: bearer(token),
      data: { shareText: 'hello there', pageUrl: 'https://example.invalid/' },
    });
    expect(unknown.status()).toBe(422);
    expect((await unknown.json()).error.code).toBe('unknown_game');
    await ext.dispose();
  });

  test('missing, wrong, revoked and cookie-only requests are refused', async ({
    page,
    playwright,
  }) => {
    await signInAs(page);
    await page.goto('/settings');
    const { id, token } = await makeToken(page);
    const base = page.url().split('/settings')[0]!;
    const ext = await playwright.request.newContext({ baseURL: base });
    const body = { shareText: wordleShare(await todayNumber('wordle')) };

    expect((await ext.post('/api/extension/capture', { data: body })).status()).toBe(401);
    expect(
      (
        await ext.post('/api/extension/capture', { headers: bearer('edx_nope'), data: body })
      ).status(),
    ).toBe(401);
    // A signed-in browser session is not enough: cookies are never accepted here.
    const withCookies = await page.request.post('/api/extension/capture', {
      data: body,
      headers: { origin: base, 'content-type': 'application/json' },
    });
    expect(withCookies.status()).toBe(401);

    expect((await apiSend(page, 'DELETE', `/api/me/capture-tokens/${id}`, {})).status()).toBe(200);
    expect(
      (await ext.post('/api/extension/capture', { headers: bearer(token), data: body })).status(),
    ).toBe(401);
    await ext.dispose();
  });

  test('Settings makes a token once, lists it and removes it', async ({ page }) => {
    await signInAs(page);
    await page.goto('/settings');
    await page.getByLabel('Name for this browser').fill('Laptop');
    await page.getByRole('button', { name: 'Make a token' }).click();
    await expect(page.getByTestId('capture-token')).toHaveText(/^edx_/);
    const list = page.getByRole('list', { name: 'Extension tokens' });
    await expect(list.getByText('Laptop')).toBeVisible();
    await page.getByRole('button', { name: 'Remove token Laptop' }).click();
    await expect(page.getByText('No tokens yet.')).toBeVisible();
  });

  test('another player cannot remove a token', async ({ page, browser }) => {
    await signInAs(page);
    await page.goto('/settings');
    const { id } = await makeToken(page);
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signInAs(other);
    await other.goto('/settings');
    expect((await apiSend(other, 'DELETE', `/api/me/capture-tokens/${id}`, {})).status()).toBe(404);
    await ctx.close();
  });
});
