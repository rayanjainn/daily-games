import AxeBuilder from '@axe-core/playwright';
import { csrfHeaders } from './support/auth';
import { follow, played } from './support/play';
import { expect, test, type Page } from './support/fixtures';
import { e2eSql } from './support/db';
import { signInAs } from './support/session';

const rows = (page: Page) => page.getByTestId('checklist-item');

test.describe('dashboard', () => {
  test('signed-in players land on today', async ({ page }) => {
    await signInAs(page);
    await page.goto('/');
    await page.waitForURL((u) => u.pathname === '/today');
  });

  test('suggests games friends follow, and following one adds it to the list', async ({ page }) => {
    const me = await signInAs(page);
    await follow(page, ['globle']);
    // Two friends who both follow Murdle.
    const sql = e2eSql();
    const murdle = (await sql`SELECT id FROM games WHERE slug = 'murdle'`)[0]!.id as string;
    for (let i = 0; i < 2; i++) {
      const [f] = await sql`INSERT INTO users (id, username, timezone)
        VALUES (gen_random_uuid(), ${`pick_${me.id.slice(0, 8)}_${i}`}, 'UTC') RETURNING id`;
      const other = f!.id as string;
      const [a, b] = me.id < other ? [me.id, other] : [other, me.id];
      await sql`INSERT INTO friendships (user_a, user_b, status, requested_by, accepted_at)
        VALUES (${a}, ${b}, 'accepted', ${other}, now())`;
      await sql`INSERT INTO follows (user_id, game_id, position) VALUES (${other}, ${murdle}, 0)`;
    }
    await sql.end();

    await page.goto('/today');
    const picks = page.getByTestId('picks');
    await expect(picks.getByRole('listitem')).toHaveCount(2);
    await expect(picks.getByRole('listitem').first()).toContainText('Murdle');
    await expect(picks.getByRole('listitem').first()).toContainText('2 friends follow it');
    await picks.getByRole('button', { name: 'Follow Murdle' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(picks).not.toContainText('Murdle');
  });

  test('a pick can be dismissed and stays gone', async ({ page }) => {
    await signInAs(page);
    await follow(page, ['wordle']);
    await page.goto('/today');
    const picks = page.getByTestId('picks').getByRole('listitem');
    await expect(picks).toHaveCount(2);
    const first = (await picks.first().getByRole('link').innerText()).trim();
    await page.getByRole('button', { name: `Not interested in ${first}` }).click();
    await expect(page.getByTestId('picks')).not.toContainText(first);
    await expect(picks).toHaveCount(2);
    await page.reload();
    await expect(page.getByTestId('picks')).not.toContainText(first);

    const exported = await (await page.request.get('/api/me/export')).json();
    expect(exported.dismissedPicks).toHaveLength(1);
  });

  test('starts empty with popular picks to follow', async ({ page }) => {
    await signInAs(page);
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Build your daily lineup' })).toBeVisible();
    await expect(page.getByTestId('combined-streak')).toContainText('0');
    await page.getByRole('button', { name: 'Follow Wordle' }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByTestId('today-headline')).toHaveText('1 puzzle waiting for you.');
    await expect(rows(page).first()).toContainText('Wordle');
    await expect(rows(page).first().getByRole('button', { name: /^Play/ })).toBeVisible();
    await expect(
      rows(page).first().getByRole('button', { name: 'Log Wordle result' }),
    ).toBeVisible();
  });

  test('shows progress, results and streaks', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'connections', 'flagle']);
    await played(user.id, 'wordle', [0, 1, 2], { attempts: 4, maxAttempts: 6 });
    await played(user.id, 'flagle', [1], { source: 'checkbox' });
    await page.goto('/today');

    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3');
    await expect(page.getByTestId('today-headline')).toHaveText('2 more to go. Nice start!');
    await expect(page.getByTestId('combined-streak')).toContainText('3');

    const wordle = rows(page).filter({ hasText: 'Wordle' });
    await expect(wordle).toHaveAttribute('data-done', 'true');
    await expect(wordle).toContainText('4/6');
    await expect(wordle.getByRole('img', { name: '3-day streak' })).toBeVisible();

    const flagle = rows(page).filter({ hasText: 'Flagle' });
    await expect(flagle).toHaveAttribute('data-done', 'false');
    await expect(flagle.getByRole('img', { name: /1-day streak, play today/ })).toBeVisible();
    await expect(flagle.getByRole('button', { name: /^Play/ })).toBeVisible();
    await expect(flagle.getByRole('button', { name: 'Log Flagle result' })).toBeVisible();
  });

  test('ticking a game off flips its tile and fills the ring in its colour', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'tradle']);
    await played(user.id, 'wordle', [0], { attempts: 3, maxAttempts: 6 });
    await page.goto('/today');
    const ring = page.getByRole('progressbar');
    await expect(ring.locator('[data-segment]')).toHaveCount(1);
    // Already done on load: no flip.
    await expect(rows(page).filter({ hasText: 'Wordle' }).locator('[data-flipped]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Mark Tradle done' }).click();
    const tradle = rows(page).filter({ hasText: 'Tradle' });
    await expect(tradle).toHaveAttribute('data-done', 'true');
    await expect(tradle.locator('[data-flipped="true"]')).toHaveCount(1);
    await expect(ring.locator('[data-segment]')).toHaveCount(2);
  });

  test('shows failures as X and celebrates a full checklist', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle']);
    await played(user.id, 'wordle', [0], { solved: false, attempts: 6, maxAttempts: 6 });
    await page.goto('/today');
    await expect(rows(page).first()).toContainText('X/6');
    await expect(page.getByTestId('today-headline')).toHaveText(
      'All done for today. See you tomorrow!',
    );
    await expect(page.getByRole('progressbar')).toContainText('All done');
  });

  test('warns when the combined streak is at risk', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'globle']);
    await played(user.id, 'globle', [1, 2, 3, 4]);
    await page.goto('/today');
    await expect(
      page.getByText('Play any one puzzle today to keep your 4-day streak.'),
    ).toBeVisible();
    await expect(page.getByTestId('combined-streak').getByRole('img')).toHaveAccessibleName(
      '4-day streak, play today to keep it',
    );
  });

  test('adds up a combined score across games', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'nyt-mini']);
    await page.goto('/today');
    await expect(page.getByTestId('points')).toHaveText('0 pts today · 0 this week');
    // Wordle in 3 of 6 is 84, a timed Mini solve a flat 70; yesterday's Wordle in 4 is 76.
    await played(user.id, 'wordle', [0], { attempts: 3, maxAttempts: 6 });
    await played(user.id, 'nyt-mini', [0], { timeSeconds: 60 });
    await played(user.id, 'wordle', [1], { attempts: 4, maxAttempts: 6 });
    // A missed puzzle and a catch-up score nothing.
    await played(user.id, 'wordle', [2], { solved: false, maxAttempts: 6 });
    await played(user.id, 'wordle', [3], { attempts: 2, maxAttempts: 6, fromArchive: true });
    await page.reload();
    await expect(page.getByTestId('points')).toHaveText('154 pts today · 230 this week');
  });

  test('seven days in a row earn a streak freeze, shown on the streak', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'globle']);
    await played(user.id, 'globle', [1, 2, 3, 4, 5, 6, 7]);
    await page.goto('/today');
    await expect(page.getByTestId('freezes')).toHaveText('1 freeze');
    await expect(page.getByTestId('combined-streak')).toContainText('7');
    await expect(page.getByText('a freeze covers the day (1 banked)')).toBeVisible();
    await expect(page.getByTestId('freeze-used')).toHaveCount(0);

    // Playing today keeps it as it was; the freeze stays banked.
    await played(user.id, 'globle', [0]);
    await page.reload();
    await expect(page.getByTestId('combined-streak')).toContainText('8');
    await expect(page.getByTestId('freezes')).toHaveText('1 freeze');
  });

  test('a freeze covers a missed day and says so', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'globle']);
    // Seven days in a row, then yesterday missed.
    await played(user.id, 'globle', [2, 3, 4, 5, 6, 7, 8]);
    await page.goto('/today');
    await expect(page.getByTestId('freeze-used')).toContainText(
      'A streak freeze covered yesterday, so your 7-day streak is safe. None left.',
    );
    await expect(page.getByTestId('freezes')).toHaveText('0 freezes');
    await expect(page.getByTestId('combined-streak').getByRole('img')).toHaveAccessibleName(
      '7-day streak, play today to keep it',
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Without a freeze the same gap ends the streak.
    const other = await signInAs(page);
    await played(other.id, 'globle', [2, 3, 4, 5, 6]);
    await page.goto('/today');
    await expect(page.getByTestId('freeze-used')).toHaveCount(0);
    await expect(page.getByTestId('combined-streak').getByRole('img')).toHaveAccessibleName(
      'No active streak',
    );
  });

  test('reorders the checklist', async ({ page }) => {
    await signInAs(page);
    await follow(page, ['wordle', 'connections', 'strands']);
    await page.goto('/today');
    const names = () => rows(page).locator('a:not([target])').allInnerTexts();
    await expect.poll(names).toEqual(['Wordle', 'Connections', 'Strands']);
    await page.getByRole('button', { name: 'Reorder' }).click();
    await expect(page.getByRole('button', { name: 'Move Wordle up' })).toBeDisabled();
    await page.getByRole('button', { name: 'Move Wordle down' }).click();
    await page.getByRole('button', { name: 'Move Strands up' }).click();
    const order = ['Connections', 'Strands', 'Wordle'];
    await expect.poll(names).toEqual(order);
    // Wait for the saves to finish before reloading.
    await expect(page.getByRole('list', { name: "Today's games" })).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await page.getByRole('button', { name: 'Done' }).click();
    await page.reload();
    await expect.poll(names).toEqual(order);

    // A list that does not match the player's follows is refused.
    const stale = await page.request.patch('/api/follows/order', {
      data: { gameIds: ['00000000-0000-4000-8000-000000000000'] },
      headers: await csrfHeaders(page),
    });
    expect(stale.status()).toBe(409);
  });

  test('has no detectable accessibility violations', async ({ page }) => {
    const user = await signInAs(page);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/today');
      expect((await new AxeBuilder({ page }).analyze()).violations, `empty ${scheme}`).toEqual([]);
    }
    await follow(page, ['wordle', 'flagle']);
    await played(user.id, 'wordle', [0, 1], { attempts: 3, maxAttempts: 6 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/today');
      await page.getByRole('button', { name: 'Reorder' }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations, `list ${scheme}`).toEqual([]);
    }
  });
});
