import AxeBuilder from '@axe-core/playwright';
import { apiPost, apiSend } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { follow } from './support/play';
import { signInAs } from './support/session';

const sub = (id: string, endpoint = `https://push.example.com/send/${id}`) => ({
  endpoint,
  keys: {
    p256dh:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
  label: 'Chrome on Android',
});

async function userRow(id: string) {
  const sql = e2eSql();
  const [u] = await sql`SELECT streak_nudge_at::text AS nudge, quiet_hours_start::text AS qs,
    quiet_hours_end::text AS qe FROM users WHERE id = ${id}`;
  const subs = await sql`SELECT label FROM push_subscriptions WHERE user_id = ${id}`;
  const f = await sql`SELECT g.slug, f.remind_at::text AS at FROM follows f
    JOIN games g ON g.id = f.game_id WHERE f.user_id = ${id} ORDER BY g.slug`;
  await sql.end();
  return { ...u!, subs: subs.map((s) => s.label), follows: f.map((r) => [r.slug, r.at]) };
}

test.describe('reminders', () => {
  test('saves per-game times, the streak nudge and quiet hours', async ({ page }) => {
    const user = await signInAs(page);
    await follow(page, ['wordle', 'connections']);
    await page.goto('/settings');
    const section = page.getByRole('region', { name: 'Reminders' });
    await expect(section.getByTestId('push-devices')).toHaveText('No devices get reminders yet.');

    await section.getByLabel('Reminder time for Wordle').fill('08:30');
    await section.getByLabel('Reminder time for Wordle').blur();
    await expect
      .poll(async () => (await userRow(user.id)).follows)
      .toEqual([
        ['connections', null],
        ['wordle', '08:30:00'],
      ]);

    await section.getByLabel(/Streak at risk/).click();
    await expect.poll(async () => (await userRow(user.id)).nudge).toBe('20:00:00');
    await section.getByLabel(/Quiet hours/).click();
    await expect.poll(async () => (await userRow(user.id)).qs).toBe('22:00:00');
    expect((await userRow(user.id)).qe).toBe('08:00:00');

    await section.getByRole('button', { name: 'Clear reminder for Wordle' }).click();
    await expect
      .poll(async () => (await userRow(user.id)).follows)
      .toEqual([
        ['connections', null],
        ['wordle', null],
      ]);
    expect(
      (await new AxeBuilder({ page }).include('#reminders-heading').analyze()).violations,
    ).toEqual([]);
  });

  test('registers and removes a device subscription', async ({ page }) => {
    const user = await signInAs(page);
    await page.goto('/settings');
    expect((await apiPost(page, '/api/push/subscriptions', sub('a'))).status()).toBe(200);
    // Re-subscribing the same browser updates it rather than adding a second device.
    expect((await apiPost(page, '/api/push/subscriptions', sub('a'))).status()).toBe(200);
    expect((await userRow(user.id)).subs).toEqual(['Chrome on Android']);
    await page.reload();
    await expect(page.getByTestId('push-devices')).toHaveText('1 device gets reminders.');

    const del = await apiSend(page, 'DELETE', '/api/push/subscriptions', {
      endpoint: sub('a').endpoint,
    });
    expect(del.status()).toBe(200);
    expect((await userRow(user.id)).subs).toEqual([]);
  });

  test('validates input and ownership', async ({ page }) => {
    await signInAs(page);
    await page.goto('/settings');
    expect(
      (
        await apiPost(page, '/api/push/subscriptions', sub('b', 'http://push.example.com/x'))
      ).status(),
    ).toBe(400);
    expect(
      (await apiSend(page, 'PATCH', '/api/me/reminders', { streakNudgeAt: '25:00' })).status(),
    ).toBe(400);
    const sql = e2eSql();
    const [g] = await sql`SELECT id FROM games WHERE slug = 'wordle'`;
    await sql.end();
    const notFollowing = await apiSend(page, 'PATCH', `/api/follows/${g!.id}/reminder`, {
      remindAt: '09:00',
    });
    expect(notFollowing.status()).toBe(404);
    // No worker in this environment: the test button reports it instead of failing silently.
    expect((await apiPost(page, '/api/push/test', {})).status()).toBe(503);
  });
});
