import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apiPost, signUpViaUi } from './support/auth';
import { e2eSql } from './support/db';
import { addVirtualAuthenticator, expect, randomIp, test } from './support/fixtures';

const uniqueName = () => `tester_${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'tidal velvet otter harbour';

/** Solves a proof-of-work challenge in the page, the way the browser does in the background. */
async function solvePow(page: Page) {
  const pow = await (await apiPost(page, '/api/auth/pow', {})).json();
  const nonce = await page.evaluate(async ({ salt, difficulty }) => {
    const enc = new TextEncoder();
    for (let n = 0; ; n++) {
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${n}`)));
      let bits = 0;
      for (const b of d) {
        if (b === 0) {
          bits += 8;
          continue;
        }
        bits += Math.clz32(b) - 24;
        break;
      }
      if (bits >= difficulty) return String(n);
    }
  }, pow);
  return { id: pow.id as string, nonce };
}

async function userRow(username: string) {
  const sql = e2eSql();
  const [u] = await sql`SELECT u.id, u.password_hash IS NOT NULL AS has_password,
      (SELECT count(*)::int FROM passkey_credentials c WHERE c.user_id = u.id) AS passkeys
    FROM users u WHERE u.username = ${username}`;
  await sql.end();
  return u!;
}

test.describe('sign-up', () => {
  test('with a passkey: two steps, no puzzle and nothing to write down', async ({ page }) => {
    const auth = await addVirtualAuthenticator(page);
    const { username } = await signUpViaUi(page, uniqueName());
    await expect(page.getByRole('heading', { name: `Hi, ${username}` })).toBeVisible();
    const creds = await auth.credentials();
    expect(creds).toHaveLength(1);
    expect(creds[0]!.isResidentCredential).toBe(true);
    expect(await userRow(username)).toMatchObject({ has_password: false, passkeys: 1 });
  });

  test('with a passkey, then a password that works on another device', async ({
    page,
    browser,
  }) => {
    await addVirtualAuthenticator(page);
    const username = uniqueName();
    await page.goto('/start');
    await page.getByLabel('Player name').fill(username);
    await expect(page.getByLabel('Available')).toBeVisible();
    await page.getByRole('button', { name: "That's me" }).click();
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByRole('heading', { name: /Signing in elsewhere/ })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Type it again').fill(PASSWORD);
    await page.getByRole('button', { name: 'Save password' }).click();
    await page.waitForURL(/\/today/);
    expect(await userRow(username)).toMatchObject({ has_password: true, passkeys: 1 });

    // A second device with no passkey signs in with the password and is offered one.
    const other = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
    const laptop = await other.newPage();
    await laptop.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
    await addVirtualAuthenticator(laptop);
    await laptop.goto('/login');
    await laptop.getByRole('button', { name: 'Sign in with a password' }).click();
    await laptop.getByLabel('Player name for password sign-in').fill(username);
    await laptop.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await laptop.getByRole('button', { name: 'Sign in', exact: true }).click();
    await laptop.waitForURL(/\/login\/add-passkey/);
    await laptop.getByRole('button', { name: 'Add a passkey' }).click();
    await laptop.waitForURL((u) => u.pathname === '/today');
    expect(await userRow(username)).toMatchObject({ passkeys: 2 });
    await other.close();
  });

  test('with only a password, then a passkey offered for this device', async ({ page }) => {
    await addVirtualAuthenticator(page);
    const username = uniqueName();
    await page.goto('/start');
    await page.getByLabel('Player name').fill(username);
    await expect(page.getByLabel('Available')).toBeVisible();
    await page.getByRole('button', { name: "That's me" }).click();
    await page.getByRole('button', { name: 'Use a password instead' }).click();
    const create = page.getByRole('button', { name: 'Create account with password' });
    await page.getByLabel('Password', { exact: true }).fill('short');
    await expect(page.getByText('Use at least 10 characters.').first()).toBeVisible();
    await expect(create).toBeDisabled();
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Type it again').fill(PASSWORD);
    await create.click();
    await expect(page.getByRole('heading', { name: /One more thing/ })).toBeVisible();
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.waitForURL(/\/today/);
    expect(await userRow(username)).toMatchObject({ has_password: true, passkeys: 0 });
  });

  test('suggests an available adjective_noun name', async ({ page }) => {
    await page.goto('/start');
    await expect(page.getByLabel('Player name')).toHaveValue(/^[a-z]+_[a-z]+(_\d{2})?$/);
    await expect(page.getByLabel('Available')).toBeVisible();
    const before = await page.getByLabel('Player name').inputValue();
    await page.getByRole('button', { name: 'Shuffle' }).click();
    await expect(page.getByLabel('Player name')).not.toHaveValue(before);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('explains why a name is not allowed', async ({ page }) => {
    await page.goto('/start');
    const input = page.getByLabel('Player name');
    for (const [name, message] of [
      ['ab', 'Use at least 3 characters.'],
      ['admin', 'That name is reserved'],
      ['has_space here', 'Use lowercase letters, numbers and underscores only.'],
      ['_edge', "Underscores can't start"],
    ] as const) {
      await input.fill(name);
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
      await expect(page.getByRole('button', { name: "That's me" })).toBeDisabled();
    }
  });

  test('blocks profanity, including leetspeak', async ({ page }) => {
    await page.goto('/start');
    await page.getByLabel('Player name').fill('sh1t_happens');
    await expect(
      page.getByRole('alert').filter({ hasText: "Let's keep it friendly" }),
    ).toBeVisible();
  });

  test('reports a name that is already taken', async ({ page, browser }) => {
    const name = uniqueName();
    const other = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': '10.200.0.9' },
    });
    const p2 = await other.newPage();
    await addVirtualAuthenticator(p2);
    await signUpViaUi(p2, name);
    await other.close();

    await page.goto('/start');
    await page.getByLabel('Player name').fill(name);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Someone already has that one.' }),
    ).toBeVisible();
  });
});

test.describe('sign-up bot protection (API level)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/start');
  });

  test('requires a valid, single-use proof of work', async ({ page }) => {
    const pow = await (await apiPost(page, '/api/auth/pow', {})).json();
    const bad = await apiPost(page, '/api/auth/signup/options', {
      username: uniqueName(),
      pow: { id: pow.id, nonce: 'x' },
    });
    expect((await bad.json()).error.code).toBe('pow_invalid');

    const good = await solvePow(page);
    const ok = await apiPost(page, '/api/auth/signup/options', {
      username: uniqueName(),
      pow: good,
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).options.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    });
    const replay = await apiPost(page, '/api/auth/signup/options', {
      username: uniqueName(),
      pow: good,
    });
    expect((await replay.json()).error.code).toBe('pow_invalid');
  });

  test('password sign-up passes the same checks and refuses weak passwords', async ({ page }) => {
    const noPow = await apiPost(page, '/api/auth/signup/password', {
      username: uniqueName(),
      password: PASSWORD,
      pow: { id: 'xxxxxxxx', nonce: '0' },
      timezone: 'UTC',
    });
    expect((await noPow.json()).error.code).toBe('pow_invalid');
    const name = uniqueName();
    const weak = await apiPost(page, '/api/auth/signup/password', {
      username: name,
      password: 'password123',
      pow: await solvePow(page),
      timezone: 'UTC',
    });
    expect(weak.status()).toBe(422);
    expect((await weak.json()).error.code).toBe('weak_password');
    const fromName = await apiPost(page, '/api/auth/signup/password', {
      username: name,
      password: `${name}-forever`,
      pow: await solvePow(page),
      timezone: 'UTC',
    });
    expect((await fromName.json()).error.message).toMatch(/player name/);
  });

  test('rate-limits sign-up attempts per IP', async ({ page }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push(
        (
          await apiPost(page, '/api/auth/signup/options', {
            username: uniqueName(),
            pow: { id: 'xxxxxxxx', nonce: '0' },
          })
        ).status(),
      );
    }
    expect(statuses.slice(0, 3)).toEqual([403, 403, 403]);
    expect(statuses).toContain(429);
  });

  test('rejects requests without CSRF token or from another origin', async ({ page }) => {
    const noToken = await page.request.post('/api/auth/pow', {
      data: {},
      headers: { origin: new URL(page.url()).origin },
    });
    expect((await noToken.json()).error.code).toBe('bad_csrf');
    const csrf = (await page.context().cookies()).find((c) => c.name.endsWith('ed_csrf'))!.value;
    const evil = await page.request.post('/api/auth/pow', {
      data: {},
      headers: { origin: 'https://evil.example', 'x-csrf-token': csrf },
    });
    expect((await evil.json()).error.code).toBe('bad_origin');
  });

  test('a challenge cannot be replayed to register twice', async ({ page }) => {
    const res = await apiPost(page, '/api/auth/signup/verify', {
      response: {
        id: 'abc',
        rawId: 'abc',
        type: 'public-key',
        response: { clientDataJSON: 'e30', attestationObject: 'e30' },
        clientExtensionResults: {},
      },
      timezone: 'UTC',
    });
    expect((await res.json()).error.code).toBe('challenge_expired');
  });
});
