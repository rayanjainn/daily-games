import { randomBytes } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { E2E_OUTBOX } from './support/env';
import { expect, test, type Page } from './support/fixtures';
import { signInAs } from './support/session';

const address = () => `m_${randomBytes(4).toString('hex')}@example.org`;

async function giveEmail(userId: string, email: string, verified = true) {
  const sql = e2eSql();
  await sql`UPDATE users SET email = ${email},
    email_verified_at = ${verified ? sql`now()` : null} WHERE id = ${userId}`;
  await sql.end();
}

async function loginLink(email: string) {
  let text = '';
  await expect
    .poll(async () => {
      text = await readFile(`${E2E_OUTBOX}/${email}.json`, 'utf8').catch(() => '');
      return text.length > 0;
    })
    .toBe(true);
  const msg = JSON.parse(text) as { subject: string; text: string };
  expect(msg.subject).toBe('Your EveryDaily sign-in link');
  const url = new URL(msg.text.match(/https?:\/\/\S+/)![0]);
  return url.pathname + url.search;
}

async function request(page: Page, email: string) {
  await page.goto('/login/email');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByText(/sign-in link is on its way/)).toBeVisible();
}

test.describe('email sign-in', () => {
  test('a link signs in once, after a tap, and the newest link wins', async ({ browser }) => {
    const setup = await browser.newContext();
    const owner = await setup.newPage();
    const user = await signInAs(owner);
    const email = address();
    await giveEmail(user.id, email);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await request(page, email);
    const first = await loginLink(email);
    await rm(`${E2E_OUTBOX}/${email}.json`);
    await request(page, email);
    const second = await loginLink(email);
    expect(second).not.toBe(first);

    // The older link was replaced.
    await page.goto(first);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/already been used or is not valid/)).toBeVisible();

    // Opening the link alone (what a mail scanner does) uses nothing up.
    await page.goto(second);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto(second);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/login\/add-passkey/);
    await page.goto('/settings');
    await expect(page.getByText(user.username).first()).toBeVisible();

    // And it only works once.
    const other = await (await browser.newContext()).newPage();
    await other.goto(second);
    await other.getByRole('button', { name: 'Sign in' }).click();
    await expect(other.getByText(/already been used or is not valid/)).toBeVisible();

    const sql = e2eSql();
    const rows =
      await sql`SELECT method FROM sessions WHERE user_id = ${user.id} ORDER BY created_at`;
    await sql.end();
    expect(rows.map((r) => r.method)).toContain('email');
  });

  test('an expired link is refused', async ({ browser }) => {
    const owner = await (await browser.newContext()).newPage();
    const user = await signInAs(owner);
    const email = address();
    await giveEmail(user.id, email);
    const page = await (await browser.newContext()).newPage();
    await request(page, email);
    const link = await loginLink(email);
    const sql = e2eSql();
    await sql`UPDATE email_tokens SET expires_at = now() - interval '1 minute'
      WHERE user_id = ${user.id} AND purpose = 'login'`;
    await sql.end();
    await page.goto(link);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/link has expired/)).toBeVisible();
  });

  test('unknown and unconfirmed addresses get the same reply and no email', async ({ browser }) => {
    const owner = await (await browser.newContext()).newPage();
    const user = await signInAs(owner);
    const unconfirmed = address();
    await giveEmail(user.id, unconfirmed, false);
    const unknown = address();
    const page = await (await browser.newContext()).newPage();
    await request(page, unknown);
    await request(page, unconfirmed);
    for (const e of [unknown, unconfirmed])
      expect(await readFile(`${E2E_OUTBOX}/${e}.json`, 'utf8').catch(() => null)).toBeNull();
    const sql = e2eSql();
    const rows =
      await sql`SELECT 1 FROM email_tokens WHERE purpose = 'login' AND user_id = ${user.id}`;
    await sql.end();
    expect(rows).toHaveLength(0);
  });

  test('the sign-in page offers the email option and is accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /Email me a sign-in link/ })).toBeVisible();
    await page.goto('/login/email');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    // Used a bad body: refused before any lookup.
    const bad = await apiPost(page, '/api/auth/email/request', { email: 'nope' });
    expect(bad.status()).toBe(400);
  });
});
