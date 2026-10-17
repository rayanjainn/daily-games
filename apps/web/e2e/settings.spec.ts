import AxeBuilder from '@axe-core/playwright';
import { apiPost, csrfHeaders, signUpViaUi } from './support/auth';
import { e2eSql } from './support/db';
import { addVirtualAuthenticator, expect, randomIp, test, type Page } from './support/fixtures';

const name = () => `set_${Math.random().toString(36).slice(2, 8)}`;

async function account(page: Page) {
  const auth = await addVirtualAuthenticator(page);
  const created = await signUpViaUi(page, name());
  return { ...created, auth };
}

async function passkeyIds(username: string) {
  const sql = e2eSql();
  const rows =
    await sql`SELECT c.id FROM passkey_credentials c JOIN users u ON u.id = c.user_id WHERE u.username = ${username}`;
  await sql.end();
  return rows.map((r) => r.id as string);
}

test.describe('settings', () => {
  test('requires a session', async ({ page }) => {
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
    await page.goto('/settings');
    await page.waitForURL(/\/login\?next=%2Fsettings/);
  });

  test('renames and removes passkeys, guarding the last one', async ({ page }) => {
    const { auth } = await account(page);
    await page.goto('/settings');
    const list = page.getByRole('list', { name: 'Your passkeys' });
    await expect(list.getByRole('listitem')).toHaveCount(1);

    await page.getByRole('button', { name: /^Rename / }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Work laptop');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(list.getByText('Work laptop')).toBeVisible();

    // Add a security key, then remove the original passkey.
    await auth.remove();
    await addVirtualAuthenticator(page, 'usb');
    await page.getByRole('button', { name: 'Add passkey' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list.getByText('Security key', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Remove Work laptop' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);

    // The last one needs an explicit second confirmation.
    await page.getByRole('button', { name: /^Remove / }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('This is your last passkey.')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove anyway' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(0);
  });

  test("cannot touch another account's passkeys or sessions (no IDOR)", async ({
    page,
    browser,
  }) => {
    const victim = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
    });
    const vp = await victim.newPage();
    await addVirtualAuthenticator(vp);
    const { username: victimName } = await signUpViaUi(vp, name());
    const [victimPasskey] = await passkeyIds(victimName);
    const sql = e2eSql();
    const [victimSession] =
      await sql`SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.username = ${victimName} AND s.revoked_at IS NULL`;
    await sql.end();

    await account(page);
    const headers = await csrfHeaders(page);
    const rename = await page.request.patch(`/api/me/passkeys/${victimPasskey}`, {
      data: { nickname: 'pwned' },
      headers,
    });
    expect(rename.status()).toBe(404);
    const del = await page.request.delete(`/api/me/passkeys/${victimPasskey}`, {
      data: { confirmLast: true },
      headers,
    });
    expect(del.status()).toBe(404);
    const killSession = await page.request.delete(`/api/me/sessions/${victimSession!.id}`, {
      data: {},
      headers,
    });
    expect(killSession.status()).toBe(404);

    expect(await passkeyIds(victimName)).toHaveLength(1);
    await vp.goto('/today');
    await expect(vp.getByRole('heading', { name: `Hi, ${victimName}` })).toBeVisible();
    await victim.close();
  });

  test('a new recovery phrase replaces the old one', async ({ page, browser }) => {
    const { username, phrase: oldPhrase } = await account(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Make a new phrase' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Make a new phrase' }).click();
    const words = page.getByTestId('new-recovery-phrase').locator('[data-word]');
    await expect(words).toHaveCount(6);
    const newPhrase = await words.allInnerTexts();
    for (let n = 1; n <= 6; n++) {
      const f = page.getByRole('dialog').getByLabel(`Word #${n}`, { exact: true });
      if (await f.count()) await f.fill(newPhrase[n - 1]!);
    }
    await page.getByRole('button', { name: 'Check and save' }).click();
    await expect(page.getByText('All set. Keep the new phrase safe.')).toBeVisible();

    const other = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
    const op = await other.newPage();
    await op.goto('/login/recover');
    expect(
      (await apiPost(op, '/api/auth/recover', { username, phrase: oldPhrase.join(' ') })).status(),
    ).toBe(401);
    expect(
      (await apiPost(op, '/api/auth/recover', { username, phrase: newPhrase.join(' ') })).status(),
    ).toBe(200);
    await other.close();
  });

  test('signs out other sessions', async ({ page, browser }) => {
    const { username, phrase } = await account(page);
    const other = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
    const op = await other.newPage();
    await op.goto('/login/recover');
    expect(
      (await apiPost(op, '/api/auth/recover', { username, phrase: phrase.join(' ') })).status(),
    ).toBe(200);
    await op.goto('/today');
    await expect(op.getByRole('heading', { name: `Hi, ${username}` })).toBeVisible();

    await page.goto('/settings');
    const sessions = page.getByRole('list', { name: 'Active sessions' });
    await expect(sessions.getByRole('listitem')).toHaveCount(2);
    await expect(sessions.getByText('Recovery phrase')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out everywhere else' }).click();
    await expect(sessions.getByRole('listitem')).toHaveCount(1);

    await op.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
    await op.goto('/today');
    await op.waitForURL(/\/login/);
    await other.close();
  });

  test('saves profile and timezone', async ({ page }) => {
    await account(page);
    await page.goto('/settings');
    await page.getByLabel('Display name').fill('Puzzle Pal');
    await page.getByLabel('Timezone').selectOption('Europe/London');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Timezone')).toHaveValue('Europe/London');
    await expect(page.getByLabel('Display name')).toHaveValue('Puzzle Pal');
  });

  test('keeps a saved timezone the browser lists under another name', async ({ page }) => {
    const { username } = await account(page);
    const sql = e2eSql();
    await sql`UPDATE users SET timezone = 'Asia/Kolkata' WHERE username = ${username}`;
    await sql.end();
    await page.goto('/settings');
    await expect(page.getByLabel('Timezone')).toHaveValue('Asia/Kolkata');
  });

  test('exports data without secrets', async ({ page }) => {
    const { username } = await account(page);
    const res = await page.request.get('/api/me/export');
    expect(res.headers()['content-disposition']).toContain(`everydaily-${username}.json`);
    const text = await res.text();
    const data = JSON.parse(text);
    expect(data.account.username).toBe(username);
    expect(data.passkeys).toHaveLength(1);
    expect(data.notes).toEqual([]);
    expect(text).not.toMatch(/publicKey|public_key|hash|argon2|token/i);
  });

  test('deletes the account and every way back in', async ({ page, browser }) => {
    const { username, phrase } = await account(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Delete forever' })).toBeDisabled();
    await dialog.getByLabel(`Type ${username} to confirm`).fill(username);
    await dialog.getByRole('button', { name: 'Delete forever' }).click();
    await page.waitForURL((u) => u.pathname === '/');

    const other = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
    const op = await other.newPage();
    await op.goto('/login/recover');
    expect(
      (await apiPost(op, '/api/auth/recover', { username, phrase: phrase.join(' ') })).status(),
    ).toBe(401);
    await other.close();
    expect(await passkeyIds(username)).toHaveLength(0);
  });

  test('has no axe violations', async ({ page }) => {
    await account(page);
    await page.goto('/settings');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(
      r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
});
