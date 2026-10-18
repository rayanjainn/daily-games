import AxeBuilder from '@axe-core/playwright';
import type { Browser } from '@playwright/test';
import { apiPost } from './support/auth';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

async function player(browser: Browser, role?: 'mod') {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = await signInAs(page, { role });
  await page.goto('/today');
  return { ctx, page, user };
}

test.describe('notifications', () => {
  test('a friend request and a reply reach the inbox, and reading clears the count', async ({
    browser,
  }) => {
    const me = await player(browser);
    const them = await player(browser);

    expect(
      (await apiPost(them.page, '/api/friends', { username: me.user.username })).status(),
    ).toBe(200);
    const post = await (
      await apiPost(me.page, '/api/c/everydaily/posts', { title: 'Notify me', body: 'hello' })
    ).json();
    expect(
      (await apiPost(them.page, `/api/posts/${post.id}/comments`, { body: 'first!' })).status(),
    ).toBe(200);
    // Commenting on your own post tells nobody.
    expect(
      (await apiPost(me.page, `/api/posts/${post.id}/comments`, { body: 'self' })).status(),
    ).toBe(200);

    await me.page.goto('/today');
    await expect(me.page.getByRole('link', { name: 'Notifications, 2 unread' })).toBeVisible();
    await me.page.getByRole('link', { name: /Notifications, 2 unread/ }).click();
    const list = me.page.getByRole('list', { name: 'Notifications' });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list).toContainText(`${them.user.username} sent you a friend request`);
    await expect(list).toContainText(`${them.user.username} replied to you`);
    expect((await new AxeBuilder({ page: me.page }).analyze()).violations).toEqual([]);

    // Opening one marks it read; "Mark all read" clears the rest.
    await list.getByRole('link', { name: /replied to you/ }).click();
    await me.page.waitForURL(/\/c\/everydaily\//);
    await me.page.goto('/notifications');
    await expect(me.page.getByRole('link', { name: 'Notifications, 1 unread' })).toBeVisible();
    await me.page.getByRole('button', { name: 'Mark all read' }).click();
    await expect(me.page.getByText('All caught up')).toBeVisible();
    await expect(me.page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();

    // The other player only got the notifications meant for them: none yet.
    await them.page.goto('/notifications');
    await expect(them.page.getByTestId('inbox-empty')).toBeVisible();

    // Accepting tells the person who asked.
    await apiPost(me.page, '/api/friends', { username: them.user.username });
    await them.page.goto('/notifications');
    await expect(them.page.getByRole('list', { name: 'Notifications' })).toContainText(
      `${me.user.username} accepted your friend request`,
    );
    await me.ctx.close();
    await them.ctx.close();
  });

  test('a moderator removing a post tells its author; one player cannot read another’s inbox', async ({
    browser,
  }) => {
    const author = await player(browser);
    const mod = await player(browser, 'mod');
    const post = await (
      await apiPost(author.page, '/api/c/everydaily/posts', { title: 'Remove me', body: 'x' })
    ).json();
    expect(
      (
        await apiPost(mod.page, `/api/admin/content/post/${post.id}`, {
          action: 'remove',
          reason: 'Off topic',
        })
      ).status(),
    ).toBe(200);
    await author.page.goto('/notifications');
    const list = author.page.getByRole('list', { name: 'Notifications' });
    await expect(list).toContainText('A moderator removed your post');
    await expect(list).toContainText('Off topic');

    // Marking someone else's ids does nothing to them.
    const ids = (await (await author.page.request.get('/api/notifications')).json()).items.map(
      (i: { id: string }) => i.id,
    );
    await apiPost(mod.page, '/api/notifications', { ids });
    const after = await (await author.page.request.get('/api/notifications')).json();
    expect(after.unread).toBe(1);
    await author.ctx.close();
    await mod.ctx.close();
  });
});
