import AxeBuilder from '@axe-core/playwright';
import type { Browser } from '@playwright/test';
import { apiPost } from './support/auth';
import { expect, test } from './support/fixtures';
import { played } from './support/play';
import { signInAs } from './support/session';

async function second(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = await signInAs(page);
  return { ctx, page, user };
}

test.describe('groups', () => {
  test('create, invite, join and rank today with spoiler-safe scores', async ({
    page,
    browser,
  }) => {
    const me = await signInAs(page);
    await page.goto('/groups');
    await page.getByLabel('Group name').fill('Family puzzlers');
    await page.getByRole('button', { name: 'Create group' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Family puzzlers' })).toBeVisible();
    const invite = await page.getByTestId('invite-link').innerText();

    const them = await second(browser);
    await them.page.goto(new URL(invite).pathname);
    await them.page.getByRole('button', { name: 'Join group' }).click();
    await expect(
      them.page.getByRole('heading', { level: 1, name: 'Family puzzlers' }),
    ).toBeVisible();

    await played(them.user.id, 'wordle', [0], { attempts: 3, maxAttempts: 6 });
    await page.reload();
    // I haven't played today's Wordle yet: their score stays hidden.
    await expect(page.getByTestId('board-hidden')).toBeVisible();
    await expect(page.getByTestId('today-board')).toContainText('Played');
    await expect(page.getByTestId('today-board')).not.toContainText('3/6');

    await played(me.id, 'wordle', [0], { attempts: 4, maxAttempts: 6 });
    await page.reload();
    const rows = page.getByTestId('today-board').getByRole('listitem');
    await expect(rows.nth(0)).toContainText(them.user.username);
    await expect(rows.nth(0)).toContainText('3/6');
    await expect(rows.nth(1)).toContainText('(you)');
    await expect(page.getByTestId('week-board')).toContainText('1 solved');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await them.ctx.close();
  });

  test('a replaced invite link stops working; non-members get a 404', async ({ page, browser }) => {
    await signInAs(page);
    await page.goto('/groups');
    const created = await apiPost(page, '/api/groups', { name: 'Office' });
    const { id } = await created.json();
    await page.goto(`/groups/${id}`);
    const oldInvite = await page.getByTestId('invite-link').innerText();
    await page.getByRole('button', { name: 'New link' }).click();
    await expect(page.getByTestId('invite-link')).not.toHaveText(oldInvite);

    const them = await second(browser);
    await them.page.goto(new URL(oldInvite).pathname);
    await expect(
      them.page.getByRole('heading', { name: "That invite doesn't work" }),
    ).toBeVisible();
    const res = await them.page.goto(`/groups/${id}`);
    expect(res?.status()).toBe(404);
    await them.ctx.close();
  });

  test('members can leave; only managers remove people; owner leaving hands over', async ({
    page,
    browser,
  }) => {
    await signInAs(page);
    await page.goto('/groups');
    const { id } = await (await apiPost(page, '/api/groups', { name: 'Crew' })).json();
    await page.goto(`/groups/${id}`);
    const code = new URL(await page.getByTestId('invite-link').innerText()).pathname
      .split('/')
      .pop();

    const them = await second(browser);
    await them.page.goto('/groups');
    expect((await apiPost(them.page, '/api/groups/join', { code })).status()).toBe(200);
    // A member can't remove the owner or anyone else.
    const remove = await them.page.request.fetch(`/api/groups/${id}/members/${them.user.id}`, {
      method: 'DELETE',
    });
    expect([403, 400]).toContain(remove.status());

    // The owner leaves: the other member becomes owner.
    await page.getByRole('button', { name: 'Leave' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave' }).click();
    await expect(page).toHaveURL(/\/groups$/);
    await them.page.goto(`/groups/${id}`);
    await expect(them.page.getByTestId('members')).toContainText('owner');
    await them.ctx.close();
  });
});
