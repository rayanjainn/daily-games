import { randomBytes } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import type { Browser } from '@playwright/test';
import { apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { follow, played } from './support/play';
import { signInAs } from './support/session';

async function second(browser: Browser, role?: 'mod') {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = await signInAs(page, role ? { role } : {});
  return { ctx, page, user };
}
const tag = () => randomBytes(3).toString('hex');

test.describe('communities', () => {
  test('post, comment, reply and vote; markdown is sanitized', async ({ page, browser }) => {
    await signInAs(page);
    await follow(page, ['wordle']);
    await page.goto('/c');
    await page.getByTestId('followed-communities').getByRole('link', { name: 'Wordle' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Wordle' })).toBeVisible();

    const title = `Best openers ${tag()}`;
    await page.getByRole('button', { name: 'New post' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title').fill(title);
    await dialog.getByLabel('Text').fill('I like **CRANE**. <script>alert(1)</script>');
    await dialog.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('.prose-comment strong')).toHaveText('CRANE');
    await expect(page.locator('.prose-comment script')).toHaveCount(0);

    await page.getByLabel('Add a comment').fill('SLATE works for me');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    const first = page.getByTestId('comment').first();
    await expect(first).toContainText('SLATE works for me');

    const other = await second(browser);
    await other.page.goto(page.url());
    await other.page.getByRole('button', { name: 'Reply' }).first().click();
    await other.page.getByLabel('Your reply').fill('Try ADIEU');
    await other.page.getByRole('button', { name: 'Reply', exact: true }).last().click();
    await expect(other.page.getByTestId('comment').first().getByTestId('comment')).toContainText(
      'Try ADIEU',
    );
    // The vote is optimistic on screen; wait for the server to have it before the other tab reloads.
    const saved = other.page.waitForResponse(
      (r) => r.url().includes('/api/votes/') && r.request().method() === 'POST',
    );
    await other.page.getByRole('button', { name: 'Upvote this post' }).click();
    await expect(other.page.getByRole('button', { name: 'Upvote this post' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((await saved).ok()).toBe(true);
    await page.reload();
    await expect(
      page
        .getByTestId(/^votes-/)
        .first()
        .getByTestId('score'),
    ).toHaveText('1');
    await expect(page.getByTestId('comment').first().getByTestId('comment')).toContainText(
      'Try ADIEU',
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await other.ctx.close();
  });

  test('||inline spoilers|| stay hidden until tapped and never show in previews', async ({
    page,
  }) => {
    await signInAs(page);
    await page.goto('/c/everydaily');
    const title = `Spoiler post ${tag()}`;
    const { id } = await (
      await apiPost(page, '/api/c/everydaily/posts', {
        title,
        body: 'Today it was ||MONGOLIA|| for me.',
      })
    ).json();

    // The feed preview hides it.
    await page.goto('/c/everydaily');
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.locator('main')).not.toContainText('MONGOLIA');

    await page.goto(`/c/everydaily/${id}`);
    const spoiler = page.getByRole('button', { name: 'Spoiler, press to reveal' });
    await expect(spoiler).toHaveCount(1);
    await expect(spoiler.locator('span')).toBeHidden();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await spoiler.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Spoiler, press to reveal' })).toHaveCount(0);
    await expect(page.locator('.spoiler[data-shown]')).toHaveText('MONGOLIA');

    // Comments work the same way, with a tap.
    await apiPost(page, `/api/posts/${id}/comments`, {
      body: 'It starts with ||M||',
      parentId: null,
    });
    await page.reload();
    await page
      .getByTestId('comments')
      .getByRole('button', { name: /Spoiler, press/ })
      .click();
    await expect(page.getByTestId('comments').locator('.spoiler[data-shown]')).toHaveText('M');
  });

  test('the daily thread hides comments until you log the puzzle', async ({ page, browser }) => {
    const me = await signInAs(page);
    await page.goto('/c/connections');
    await page.getByTestId('daily-thread').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Daily thread: Connections',
    );

    const other = await second(browser);
    await other.page.goto(page.url());
    await other.page.getByLabel('Add a comment').fill('Purple was anagrams today');
    await other.page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(other.page.getByTestId('comment')).toHaveCount(1);

    await page.reload();
    await expect(page.getByTestId('comments-hidden')).toBeVisible();
    await expect(page.getByText('Purple was anagrams today')).toHaveCount(0);
    await page.getByTestId('spoiler').first().click();
    await expect(page.getByText('Purple was anagrams today')).toBeVisible();

    await played(me.id, 'connections', [0], { attempts: 4, maxAttempts: 4 });
    await page.reload();
    await expect(page.getByTestId('comments-hidden')).toHaveCount(0);
    await expect(page.getByText('Purple was anagrams today')).toBeVisible();
    await other.ctx.close();
  });

  test('reports reach moderators, who remove content (audit-logged)', async ({ page, browser }) => {
    await signInAs(page);
    await page.goto('/c/everydaily');
    const title = `Rude post ${tag()}`;
    const res = await apiPost(page, '/api/c/everydaily/posts', { title, body: 'spam spam' });
    const { id } = await res.json();

    const reporter = await second(browser);
    await reporter.page.goto(`/c/everydaily/${id}`);
    await reporter.page.getByRole('button', { name: 'Report' }).first().click();
    await reporter.page.getByRole('dialog').getByLabel("What's wrong?").fill('Spam');
    await reporter.page.getByRole('dialog').getByRole('button', { name: 'Send report' }).click();
    await expect(reporter.page.getByRole('dialog')).toHaveCount(0);

    const mod = await second(browser, 'mod');
    await mod.page.goto('/admin');
    const row = mod.page
      .getByRole('region', { name: /Community reports/ })
      .getByRole('listitem')
      .filter({ hasText: title });
    await row.getByRole('button', { name: 'Remove' }).click();
    await expect(row).toHaveCount(0);

    // Removed content is gone for everyone except moderators.
    const gone = await reporter.page.goto(`/c/everydaily/${id}`);
    expect(gone?.status()).toBe(404);
    const sql = e2eSql();
    const audit = await sql`SELECT action FROM mod_actions WHERE target_id = ${id}`;
    await sql.end();
    expect(audit.map((a) => a.action)).toEqual(['post.remove']);
    await reporter.ctx.close();
    await mod.ctx.close();
  });

  test('board moderators handle their own board only, appointed by site moderators', async ({
    page,
    browser,
  }) => {
    const author = await signInAs(page);
    const title = `Board report ${tag()}`;
    await page.goto('/c/everydaily');
    const { id } = await (
      await apiPost(page, '/api/c/everydaily/posts', { title, body: 'spam spam' })
    ).json();
    await page.goto('/c/wordle');
    const { id: elsewhere } = await (
      await apiPost(page, '/api/c/wordle/posts', { title: `Other board ${tag()}` })
    ).json();

    const reporter = await second(browser);
    await reporter.page.goto(`/c/everydaily/${id}`);
    await reporter.page.getByRole('button', { name: 'Report' }).first().click();
    await reporter.page.getByRole('dialog').getByLabel("What's wrong?").fill('Spam');
    await reporter.page.getByRole('dialog').getByRole('button', { name: 'Send report' }).click();
    await expect(reporter.page.getByRole('dialog')).toHaveCount(0);

    // Before being appointed, a player has no moderation page and no moderation actions.
    const helper = await second(browser);
    expect((await helper.page.goto('/c/everydaily/mod'))?.status()).toBe(404);
    const denied = await apiPost(helper.page, `/api/admin/content/post/${id}`, {
      action: 'remove',
      reason: 'x',
    });
    expect(denied.status()).toBe(403);

    const site = await second(browser, 'mod');
    await site.page.goto('/c/everydaily/mod');
    await site.page.getByLabel('Player name').fill(helper.user.username);
    await site.page.getByRole('button', { name: 'Add moderator' }).click();
    await expect(site.page.getByTestId('board-moderators')).toContainText(helper.user.username);

    // Now they see this board's reports and can act on them...
    await helper.page.goto('/c/everydaily');
    await expect(helper.page.getByRole('link', { name: 'Moderation' })).toBeVisible();
    await helper.page.goto('/c/everydaily/mod');
    const row = helper.page.getByTestId('board-reports').getByRole('listitem').filter({
      hasText: title,
    });
    await expect(row).toHaveCount(1);
    expect((await new AxeBuilder({ page: helper.page }).analyze()).violations).toEqual([]);
    await row.getByRole('button', { name: 'Remove' }).click();
    await expect(row).toHaveCount(0);
    expect((await reporter.page.goto(`/c/everydaily/${id}`))?.status()).toBe(404);
    // ...but not in another board, and they cannot appoint anyone.
    const other = await apiPost(helper.page, `/api/admin/content/post/${elsewhere}`, {
      action: 'remove',
      reason: 'x',
    });
    expect(other.status()).toBe(403);
    const appoint = await apiPost(helper.page, '/api/admin/communities/everydaily/moderators', {
      username: author.username,
    });
    expect(appoint.status()).toBe(403);
    await expect(helper.page.getByRole('button', { name: 'Add moderator' })).toHaveCount(0);

    const sql = e2eSql();
    const audit = await sql`SELECT action, actor_id FROM mod_actions WHERE target_id = ${id}`;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'post.remove', actor_id: helper.user.id });

    // Removing the appointment takes the access away again.
    await site.page.reload();
    await site.page
      .getByRole('button', { name: `Remove ${helper.user.username} as moderator` })
      .click();
    await expect(site.page.getByTestId('board-moderators')).toHaveCount(0);
    expect((await helper.page.goto('/c/everydaily/mod'))?.status()).toBe(404);
    const trail = await sql`SELECT action FROM mod_actions
      WHERE action LIKE 'community_moderator.%' AND after::text LIKE ${`%${helper.user.username}%`}
         OR before::text LIKE ${`%${helper.user.id}%`}`;
    await sql.end();
    expect(trail.length).toBeGreaterThanOrEqual(2);
    for (const c of [reporter, helper, site]) await c.ctx.close();
  });

  test('locked posts take no comments; unknown boards are 404', async ({ page, browser }) => {
    await signInAs(page);
    await page.goto('/c/everydaily');
    const { id } = await (
      await apiPost(page, '/api/c/everydaily/posts', { title: `Lock me ${tag()}` })
    ).json();
    const mod = await second(browser, 'mod');
    await mod.page.goto(`/c/everydaily/${id}`);
    await mod.page.getByRole('button', { name: 'Lock' }).first().click();
    await expect(mod.page.getByText('This post is locked')).toBeVisible();
    const res = await apiPost(page, `/api/posts/${id}/comments`, { body: 'late' });
    expect(res.status()).toBe(403);
    expect((await page.goto('/c/not-a-real-game'))?.status()).toBe(404);
    await mod.ctx.close();
  });
});
