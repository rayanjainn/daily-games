import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { apiPost, apiSend } from './support/auth';
import { e2eSql } from './support/db';
import { E2E_OUTBOX } from './support/env';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

const address = () => `p_${randomBytes(4).toString('hex')}@example.org`;

async function linkSentTo(email: string) {
  let text = '';
  await expect
    .poll(async () => {
      text = await readFile(`${E2E_OUTBOX}/${email}.json`, 'utf8').catch(() => '');
      return text.length > 0;
    })
    .toBe(true);
  const msg = JSON.parse(text) as { subject: string; text: string };
  expect(msg.subject).toBe('Confirm your email for EveryDaily');
  return new URL(msg.text.match(/https?:\/\/\S+/)![0]);
}

async function flags(userId: string) {
  const sql = e2eSql();
  const [u] = await sql`SELECT email, email_verified_at IS NOT NULL AS verified,
    email_reminders AS reminders FROM users WHERE id = ${userId}`;
  await sql.end();
  return u!;
}

test.describe('email', () => {
  test('adds, confirms by link, and turns on email reminders', async ({ page }) => {
    const user = await signInAs(page);
    const email = address();
    await page.goto('/settings');
    const section = page.getByRole('region', { name: 'Email' });
    await section.getByLabel('Email address').fill(email);
    await section.getByRole('button', { name: 'Send confirmation link' }).click();
    await expect(section.getByTestId('email-status')).toContainText('Not confirmed');

    const link = await linkSentTo(email);
    await page.goto(link.pathname + link.search);
    await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // The link is single use.
    await page.goto(link.pathname + link.search);
    await expect(page.getByRole('heading', { name: "That link doesn't work" })).toBeVisible();

    await page.goto('/settings');
    await expect(section.getByTestId('email-status')).toContainText('Confirmed');
    await page
      .getByRole('region', { name: 'Reminders' })
      .getByLabel(/Also email me/)
      .click();
    await expect.poll(async () => (await flags(user.id)).reminders).toBe(true);
  });

  test('refuses email reminders before confirming, and an address used elsewhere', async ({
    page,
    browser,
  }) => {
    await signInAs(page);
    await page.goto('/settings');
    const res = await apiSend(page, 'PATCH', '/api/me/reminders', { emailReminders: true });
    expect(res.status()).toBe(422);

    const email = address();
    expect((await apiPost(page, '/api/me/email', { email })).status()).toBe(200);
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signInAs(other);
    await other.goto('/settings');
    const taken = await apiPost(other, '/api/me/email', { email: email.toUpperCase() });
    expect(taken.status()).toBe(409);
    await ctx.close();
  });

  test('changing or removing the address resets confirmation and email reminders', async ({
    page,
  }) => {
    const user = await signInAs(page);
    const first = address();
    await page.goto('/settings');
    await apiPost(page, '/api/me/email', { email: first });
    const link = await linkSentTo(first);
    await page.goto(link.pathname + link.search);
    await page.goto('/settings');
    await apiSend(page, 'PATCH', '/api/me/reminders', { emailReminders: true });
    expect(await flags(user.id)).toMatchObject({ verified: true, reminders: true });

    await apiPost(page, '/api/me/email', { email: address() });
    expect(await flags(user.id)).toMatchObject({ verified: false, reminders: false });
    // The old link no longer confirms anything.
    await page.goto(link.pathname + link.search);
    await expect(page.getByRole('heading', { name: "That link doesn't work" })).toBeVisible();

    await page.goto('/settings');
    await page
      .getByRole('region', { name: 'Email' })
      .getByRole('button', { name: 'Remove' })
      .click();
    await expect(
      page.getByRole('region', { name: 'Email' }).getByLabel('Email address'),
    ).toBeVisible();
    expect(await flags(user.id)).toMatchObject({ email: null, verified: false });
  });
});
