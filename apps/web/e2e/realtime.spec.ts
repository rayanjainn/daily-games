import type { Browser } from '@playwright/test';
import { apiPost } from './support/auth';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

/** Needs the worker: run with E2E_REALTIME=1 (see playwright.config.ts). */
test.skip(process.env.E2E_REALTIME !== '1', 'set E2E_REALTIME=1 to run against wrangler dev');

async function player(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = await signInAs(page);
  return { ctx, page, user };
}

test.describe('realtime', () => {
  test('comments, typing and presence reach other readers live', async ({ browser }) => {
    const a = await player(browser);
    const b = await player(browser);
    await a.page.goto('/c/everydaily');
    const { id } = await (
      await apiPost(a.page, '/api/c/everydaily/posts', { title: 'Live chat check' })
    ).json();
    await a.page.goto(`/c/everydaily/${id}`);
    await b.page.goto(`/c/everydaily/${id}`);
    const barA = a.page.getByTestId('live-bar');
    await expect(barA).toContainText('Live');
    await expect(barA).toContainText('2 here');

    await b.page.getByLabel('Add a comment').pressSequentially('hello');
    await expect(barA).toContainText(`${b.user.username} is typing…`);
    await b.page.getByRole('button', { name: 'Comment', exact: true }).click();
    // No reload on A's side: the comment arrives over the socket.
    await expect(a.page.getByTestId('comment')).toContainText('hello');

    await b.ctx.close();
    await expect(barA).toContainText('1 here');
    await a.ctx.close();
  });

  test('a group board updates when a member logs a result', async ({ browser }) => {
    const a = await player(browser);
    const b = await player(browser);
    await a.page.goto('/groups');
    const { id } = await (await apiPost(a.page, '/api/groups', { name: 'Live board' })).json();
    await a.page.goto(`/groups/${id}`);
    const code = new URL(await a.page.getByTestId('invite-link').innerText()).pathname
      .split('/')
      .pop();
    await b.page.goto('/groups');
    await apiPost(b.page, '/api/groups/join', { code });
    await apiPost(a.page, '/api/results', { source: 'checkbox', slug: 'tradle' });
    await a.page.reload();
    await expect(a.page.getByTestId('live-bar')).toContainText('Live');

    await apiPost(b.page, '/api/results', { source: 'checkbox', slug: 'tradle' });
    await expect(a.page.getByTestId('today-board')).toContainText(b.user.username);
    await expect(a.page.getByTestId('week-board')).toContainText('1 solved · 1 played');

    // Someone outside the group can't get into its room.
    const stranger = await player(browser);
    await stranger.page.goto('/groups');
    const res = await apiPost(stranger.page, '/api/realtime/token', { room: `group:${id}` });
    expect(res.status()).toBe(403);
    await stranger.ctx.close();
    await a.ctx.close();
    await b.ctx.close();
  });

  test('the friends board updates when a friend logs a result, and stays private', async ({
    browser,
  }) => {
    const a = await player(browser);
    const b = await player(browser);
    await a.page.goto('/friends');
    await apiPost(a.page, '/api/friends', { username: b.user.username });
    await b.page.goto('/friends');
    await b.page.getByRole('button', { name: `Accept ${a.user.username}` }).click();
    await expect(b.page.getByTestId('friends')).toContainText(a.user.username);

    await a.page.reload();
    await expect(a.page.getByTestId('live-bar')).toContainText('Live');
    await apiPost(b.page, '/api/results', { source: 'checkbox', slug: 'tradle' });
    await expect(a.page.getByTestId('today-board')).toContainText(b.user.username);

    // Only you can join your own friends room.
    const res = await apiPost(a.page, '/api/realtime/token', { room: `friends:${b.user.id}` });
    expect(res.status()).toBe(403);
    await a.ctx.close();
    await b.ctx.close();
  });
});
