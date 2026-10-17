import AxeBuilder from '@axe-core/playwright';
import { apiPost, csrfHeaders } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test, type Page } from './support/fixtures';
import { follow } from './support/play';
import { signInAs } from './support/session';

/** Today's puzzle number for a local-midnight game, for a player in UTC. */
async function todayNumber(slug: string): Promise<number> {
  const sql = e2eSql();
  const [r] = await sql`
    SELECT epoch_number + ((now() AT TIME ZONE 'UTC')::date - puzzle_epoch) AS n
    FROM games WHERE slug = ${slug}`;
  await sql.end();
  return Number(r!.n);
}

/** A Wordle share whose grid matches the score (the parser rejects mismatches as tampered). */
function wordleShare(n: number, score = '4/6') {
  const [got] = score.split('/');
  const rows = got === 'X' ? 6 : Number(got);
  const grid = Array.from({ length: rows }, (_, i) =>
    i === rows - 1 && got !== 'X' ? '🟩🟩🟩🟩🟩' : '⬛🟨⬛⬛🟩',
  ).join('\n');
  return `Wordle ${n.toLocaleString('en-US')} ${score}\n\n${grid}`;
}

async function resultsFor(userId: string) {
  const sql = e2eSql();
  const rows = await sql`
    SELECT g.slug, r.puzzle_number, r.solved, r.attempts, r.time_seconds, r.source, r.raw_share_text
    FROM results r JOIN games g ON g.id = r.game_id WHERE r.user_id = ${userId}
    ORDER BY r.created_at`;
  await sql.end();
  return rows;
}

/** Keep external game sites out of the tests. */
async function stubGameSites(page: Page) {
  await page
    .context()
    .route(/^https:\/\/(?!localhost)/, (r) =>
      r.fulfill({ contentType: 'text/html', body: '<title>Game</title><p>A daily game</p>' }),
    );
}

const panel = (page: Page) => page.locator('#log-panel');

test.describe('result logging', () => {
  test('pastes a share, previews it, saves it once and can undo', async ({ page }) => {
    const user = await signInAs(page);
    const n = await todayNumber('wordle');
    await page.goto('/games/wordle');
    const box = panel(page).getByLabel('Your Wordle share text');
    await box.fill(wordleShare(n));
    const preview = page.getByTestId('log-preview');
    await expect(preview).toContainText('4/6');
    await expect(preview).toContainText(`#${n.toLocaleString('en-US')}`);
    await panel(page).getByRole('button', { name: 'Save result' }).click();
    await expect(page.getByTestId('log-success')).toContainText('Logged: 4/6');

    const saved = await resultsFor(user.id);
    expect(saved).toMatchObject([
      { slug: 'wordle', puzzle_number: n, solved: true, attempts: 4, source: 'paste' },
    ]);
    expect(saved[0]!.raw_share_text).toContain('Wordle');

    // Same puzzle again: the preview says so and saving is refused.
    await page.reload();
    await expect(page.getByTestId('logged-today')).toContainText('Today: 4/6');
    const dup = await apiPost(page, '/api/results', {
      source: 'paste',
      slug: 'wordle',
      shareText: wordleShare(n, '2/6'),
    });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error.summary).toBe('4/6');

    await page.getByRole('button', { name: 'Remove and log again' }).click();
    await expect(panel(page).getByLabel('Your Wordle share text')).toBeVisible();
    await expect.poll(() => resultsFor(user.id)).toEqual([]);
  });

  test('rejects malformed, wrong-game and future shares', async ({ page }) => {
    await signInAs(page);
    const n = await todayNumber('wordle');
    await page.goto('/games/wordle');
    const box = panel(page).getByLabel('Your Wordle share text');
    const save = panel(page).getByRole('button', { name: 'Save result' });

    await box.fill('I did great today!');
    await expect(panel(page).getByRole('alert')).toBeVisible();
    await expect(save).toBeDisabled();

    await box.fill('Connections\nPuzzle #500\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪');
    await expect(panel(page).getByRole('alert')).toBeVisible();
    await expect(save).toBeDisabled();

    await box.fill(wordleShare(n + 2));
    await expect(panel(page).getByRole('alert')).toHaveText(
      "That puzzle hasn't been released yet.",
    );
    await expect(save).toBeDisabled();

    // Earlier puzzles (archive) are fine.
    await box.fill(wordleShare(n - 3, 'X/6'));
    await expect(page.getByTestId('log-preview')).toContainText('X/6');
    await expect(save).toBeEnabled();
  });

  test('preview flags a puzzle that is already logged', async ({ page }) => {
    await signInAs(page);
    const n = await todayNumber('wordle');
    await page.goto('/games/wordle');
    expect(
      (
        await apiPost(page, '/api/results', {
          source: 'paste',
          slug: 'wordle',
          shareText: wordleShare(n - 1),
        })
      ).status(),
    ).toBe(200);
    await panel(page)
      .getByLabel('Your Wordle share text')
      .fill(wordleShare(n - 1, '3/6'));
    await expect(page.getByTestId('log-preview')).toContainText('You already logged this puzzle.');
    await expect(panel(page).getByRole('button', { name: 'Save result' })).toBeDisabled();
  });

  test('enters a score by hand', async ({ page }) => {
    const user = await signInAs(page);
    await page.goto('/games/nyt-mini');
    await panel(page).getByRole('tab', { name: 'Enter score' }).click();
    await panel(page).getByLabel('Time').fill('1:5');
    await panel(page).getByRole('button', { name: 'Save result' }).click();
    await expect(panel(page).getByRole('alert')).toHaveText('Enter a time like 1:23.');
    await panel(page).getByLabel('Time').fill('0:42');
    await panel(page).getByRole('button', { name: 'Save result' }).click();
    await expect(page.getByTestId('log-success')).toContainText('Logged: 0:42');
    expect(await resultsFor(user.id)).toMatchObject([
      { slug: 'nyt-mini', time_seconds: 42, solved: true, source: 'manual' },
    ]);

    // The server enforces the game's limits too.
    const tooMany = await apiPost(page, '/api/results', {
      source: 'manual',
      slug: 'wordle',
      entry: { solved: true, attempts: 7 },
    });
    expect(tooMany.status()).toBe(422);
    const checkboxOnScored = await apiPost(page, '/api/results', {
      source: 'checkbox',
      slug: 'wordle',
    });
    expect(checkboxOnScored.status()).toBe(422);
    const future = await apiPost(page, '/api/results', {
      source: 'manual',
      slug: 'wordle',
      entry: { solved: true, attempts: 3, puzzleNumber: (await todayNumber('wordle')) + 2 },
    });
    expect(future.status()).toBe(422);
  });

  test('check-off games log with one tap', async ({ page }) => {
    const user = await signInAs(page);
    await page.goto('/games/tradle');
    await expect(panel(page).getByRole('heading', { name: 'Done today?' })).toBeVisible();
    await panel(page).getByRole('button', { name: 'Mark today done' }).click();
    await expect(page.getByTestId('log-success')).toContainText('Logged: Done');
    expect(await resultsFor(user.id)).toMatchObject([{ slug: 'tradle', source: 'checkbox' }]);
    const paste = await apiPost(page, '/api/results', {
      source: 'paste',
      slug: 'tradle',
      shareText: 'Tradle #1 3/6',
    });
    expect(paste.status()).toBe(422);
  });

  test('logs from the dashboard checklist', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'tradle']);
    const n = await todayNumber('wordle');
    await page.goto('/today');
    await page.getByRole('button', { name: 'Mark Tradle done' }).click();
    await expect(page.getByTestId('checklist-item').filter({ hasText: 'Tradle' })).toHaveAttribute(
      'data-done',
      'true',
    );

    await page.getByRole('button', { name: 'Log Wordle result' }).click();
    const sheet = page.getByRole('dialog', { name: 'Log Wordle' });
    await sheet.getByLabel('Your Wordle share text').fill(wordleShare(n, '3/6'));
    await expect(sheet.getByTestId('log-preview')).toContainText('3/6');
    await sheet.getByRole('button', { name: 'Save result' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('today-headline')).toHaveText(
      'All done for today. See you tomorrow!',
    );
    await expect(page.getByTestId('checklist-item').filter({ hasText: 'Wordle' })).toContainText(
      '3/6',
    );
    expect((await resultsFor(user.id)).map((r) => r.slug).sort()).toEqual(['tradle', 'wordle']);
  });

  test('opens popout games only on click, with a fallback when blocked', async ({ page }) => {
    await signInAs(page);
    await stubGameSites(page);
    await page.goto('/games/wordle');
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByTestId('play-button').click(),
    ]);
    await expect.poll(() => popup.url()).toBe('https://www.nytimes.com/games/wordle/index.html');
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();

    await page.addInitScript(() => {
      window.open = () => null;
    });
    await page.reload();
    await page.getByTestId('play-button').click();
    const blocked = page.getByTestId('popup-blocked');
    await expect(blocked).toContainText('Your browser blocked the game window.');
    await expect(blocked.getByRole('link', { name: 'Open nytimes.com' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  test('asks for the result when a phone player comes back', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page);
    await page.addInitScript(() => {
      window.open = () => ({ opener: null }) as Window;
    });
    await page.goto('/games/wordle');
    await page.getByTestId('play-button').click();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const sheet = page.getByRole('dialog', { name: 'How did Wordle go?' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('Your Wordle share text')).toBeVisible();
  });

  test('frames verified games in a sandbox and falls back when the frame never loads', async ({
    page,
  }) => {
    test.slow();
    await signInAs(page);
    const sql = e2eSql();
    const slug = `framed-${Math.random().toString(36).slice(2, 7)}`;
    await sql`INSERT INTO games (id, slug, name, publisher, description, url, category, difficulty,
      tier, embed_mode, verified_embeddable_at, reset_mode, puzzle_epoch, epoch_number,
      scoring_type, accent_color, icon, attribution_note)
      VALUES (gen_random_uuid(), ${slug}, 'Framed Test', 'Framers', 'A game that allows framing.',
      ${`https://frame.example.test/${slug}`}, 'logic', 'easy', 3, 'iframe', now(), 'user_local',
      '2025-01-01', 1, 'completion', '#4361EE', 'brain', 'Made and hosted by Framers.')`;
    await sql.end();

    await page
      .context()
      .route('https://frame.example.test/**', (r) =>
        r.fulfill({ contentType: 'text/html', body: '<p>Framed game</p>' }),
      );
    await page.goto(`/games/${slug}`);
    await page.getByRole('link', { name: /Play on frame\.example\.test/ }).click();
    await page.waitForURL(`**/games/${slug}/play`);
    const frame = page.getByTestId('game-frame');
    await expect(frame).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-forms',
    );
    await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(
      page.frameLocator('[data-testid="game-frame"]').getByText('Framed game'),
    ).toBeVisible();
    await expect(page.getByTestId('frame-loading')).toBeHidden();

    // A frame that never loads degrades to opening the game in its own window.
    await page.context().unroute('https://frame.example.test/**');
    await page.context().route('https://frame.example.test/**', () => {
      /* never answer */
    });
    await page.reload();
    await expect(page.getByTestId('frame-blocked')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('frame-blocked')).toContainText(
      "doesn't allow being shown inside other sites",
    );

    // Popout games never get a frame.
    await page.goto('/games/wordle/play');
    await page.waitForURL((u) => u.pathname === '/games/wordle');
  });

  test('result APIs check sessions, CSRF and ownership', async ({ page, browser }) => {
    await signInAs(page);
    const n = await todayNumber('wordle');
    await page.goto('/games/wordle');
    const res = await apiPost(page, '/api/results', {
      source: 'extension',
      slug: 'wordle',
      shareText: wordleShare(n),
    });
    expect(res.status()).toBe(200);
    const { id } = (await res.json()) as { id: string };

    const noCsrf = await page.request.post('/api/results', {
      data: { source: 'checkbox', slug: 'tradle' },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(noCsrf.status()).toBe(403);
    expect(
      (
        await apiPost(page, '/api/results', {
          source: 'paste',
          slug: 'wordle',
          shareText: 'x'.repeat(5000),
        })
      ).status(),
    ).toBe(400);
    expect(
      (await apiPost(page, '/api/results', { source: 'checkbox', slug: 'no-such-game' })).status(),
    ).toBe(404);

    // Another player cannot delete this result.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signInAs(otherPage);
    await otherPage.goto('/today');
    const del = await otherPage.request.delete(`/api/results/${id}`, {
      data: {},
      headers: await csrfHeaders(otherPage),
    });
    expect(del.status()).toBe(404);
    await other.close();
  });

  test('logging screens have no detectable accessibility violations', async ({ page }) => {
    await signInAs(page);
    const n = await todayNumber('wordle');
    await page.goto('/games/wordle');
    await panel(page).getByLabel('Your Wordle share text').fill(wordleShare(n));
    await expect(page.getByTestId('log-preview')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await panel(page).getByRole('tab', { name: 'Enter score' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto('/games/tradle');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
