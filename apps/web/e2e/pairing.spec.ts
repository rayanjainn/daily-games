import type { Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { apiPost, signUpViaUi } from './support/auth';
import { e2eSql } from './support/db';
import { addVirtualAuthenticator, expect, randomIp, test, type Page } from './support/fixtures';

async function newDevice(browser: Browser) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
  const page = await ctx.newPage();
  await page.goto('/login/pair');
  await expect(page.getByTestId('pair-number')).toBeVisible();
  const number = Number(await page.getByTestId('pair-number').innerText());
  const url = await page.getByTestId('pair-url').innerText();
  return { ctx, page, number, path: new URL(url).pathname };
}

async function signedInPhone(page: Page) {
  await addVirtualAuthenticator(page);
  return signUpViaUi(page, `pair_${Math.random().toString(36).slice(2, 8)}`);
}

test.describe('device pairing', () => {
  test('approving with the right number signs in the new device as the same user', async ({
    page,
    browser,
  }) => {
    const { username } = await signedInPhone(page);
    const laptop = await newDevice(browser);
    await expect(
      laptop.page.getByRole('img', { name: 'QR code to approve this sign-in' }),
    ).toBeVisible();

    await page.goto(laptop.path);
    await expect(page.getByRole('heading', { name: 'Approve a sign-in?' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: String(laptop.number), exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: String(laptop.number), exact: true }).click();
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();

    await laptop.page.waitForURL(/\/login\/add-passkey/);
    await laptop.page.getByRole('button', { name: 'Not now' }).click();
    await laptop.page.waitForURL((u) => u.pathname === '/today');
    await expect(laptop.page.getByRole('heading', { name: `Hi, ${username}` })).toBeVisible();
    await laptop.ctx.close();
  });

  test('a wrong number cancels the request on both sides', async ({ page, browser }) => {
    await signedInPhone(page);
    const laptop = await newDevice(browser);
    await page.goto(laptop.path);
    const wrong = (await page.getByRole('group').getByRole('button').allInnerTexts())
      .map(Number)
      .find((n) => n !== laptop.number)!;
    await page.getByRole('button', { name: String(wrong), exact: true }).click();
    await expect(
      page.getByRole('alert').or(page.getByText("That number didn't match")),
    ).toBeVisible();
    await expect(
      laptop.page.getByText('The request was declined on your other device.'),
    ).toBeVisible({ timeout: 10_000 });
    await laptop.ctx.close();
  });

  test('declining stops the new device from signing in', async ({ page, browser }) => {
    await signedInPhone(page);
    const laptop = await newDevice(browser);
    await page.goto(laptop.path);
    await page.getByRole('button', { name: "This wasn't me, decline" }).click();
    await expect(page.getByText('Declined. Nobody was signed in.')).toBeVisible();
    await expect(
      laptop.page.getByText('The request was declined on your other device.'),
    ).toBeVisible({ timeout: 10_000 });
    await laptop.ctx.close();
  });

  test('approval links require being signed in', async ({ page, browser }) => {
    const laptop = await newDevice(browser);
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
    await page.goto(laptop.path);
    await page.waitForURL(/\/login\?next=%2Fpair%2F/);
    await laptop.ctx.close();
  });

  test('an approval can be consumed only once, and only by the device that started it', async ({
    page,
    browser,
  }) => {
    await signedInPhone(page);
    const laptop = await newDevice(browser);
    const code = laptop.path.split('/').pop()!;
    // Approve via API, then stop the laptop's poller from racing us by reading its cookie.
    await laptop.page.route('**/api/auth/pair/status', (r) =>
      r.fulfill({ json: { status: 'pending' } }),
    );
    expect(
      (await apiPost(page, '/api/auth/pair/approve', { code, number: laptop.number })).status(),
    ).toBe(200);

    // A different browser cannot consume it.
    const thief = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
    const tp = await thief.newPage();
    await tp.goto('/login');
    expect((await (await apiPost(tp, '/api/auth/pair/consume', {})).json()).error.code).toBe(
      'pair_not_approved',
    );
    await thief.close();

    expect((await apiPost(laptop.page, '/api/auth/pair/consume', {})).status()).toBe(200);
    // The pairing cookie was cleared; a replay with the same secret fails too.
    expect(
      (await (await apiPost(laptop.page, '/api/auth/pair/consume', {})).json()).error.code,
    ).toBe('pair_not_approved');
    await laptop.ctx.close();
  });

  test('expired requests cannot be approved', async ({ page, browser }) => {
    await signedInPhone(page);
    const laptop = await newDevice(browser);
    const sql = e2eSql();
    await sql`UPDATE device_pairings SET expires_at = now() - interval '1 second' WHERE status = 'pending' AND number_match = ${laptop.number}`;
    await sql.end();
    await page.goto(laptop.path);
    await expect(
      page.getByText('This sign-in request has expired or was already handled.'),
    ).toBeVisible();
    await expect(laptop.page.getByText('The code expired before it was approved.')).toBeVisible({
      timeout: 10_000,
    });
    await laptop.ctx.close();
  });

  test('both screens pass axe', async ({ page, browser }) => {
    await signedInPhone(page);
    const laptop = await newDevice(browser);
    for (const p of [laptop.page]) {
      const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.map((v) => v.id)).toEqual([]);
    }
    await page.goto(laptop.path);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id)).toEqual([]);
    await laptop.ctx.close();
  });
});
