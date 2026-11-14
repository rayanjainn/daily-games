import { apiPost, csrfHeaders, signUpViaUi } from './support/auth';
import { e2eSql } from './support/db';
import { addVirtualAuthenticator, expect, test, type Page } from './support/fixtures';

const name = () => `login_${Math.random().toString(36).slice(2, 8)}`;

/** Sign out lives in Settings. */
async function signOut(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((u) => u.pathname === '/');
}

const sessionCookie = async (page: Page) =>
  (await page.context().cookies()).find((c) => c.name.endsWith('ed_session'));

test.describe('passkey sign-in', () => {
  // Most tests below exercise the explicit button; switch off autofill so it doesn't race them.
  test.beforeEach(async ({ page }, info) => {
    if (info.title.includes('conditional UI')) return;
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
  });

  test('signs in with the passkey button and honours ?next', async ({ page }) => {
    await addVirtualAuthenticator(page);
    const { username } = await signUpViaUi(page, name());
    await signOut(page);
    await page.goto('/login?next=/today%3Ffrom%3Dlogin');
    await page.getByRole('button', { name: 'Sign in with passkey' }).click();
    await page.waitForURL(/\/today\?from=login/);
    await expect(page.getByRole('heading', { name: `Hi, ${username}` })).toBeVisible();
  });

  test('ignores off-site ?next targets', async ({ page }) => {
    await addVirtualAuthenticator(page);
    await signUpViaUi(page, name());
    await signOut(page);
    await page.goto('/login?next=https://evil.example/steal');
    await page.getByRole('button', { name: 'Sign in with passkey' }).click();
    await page.waitForURL((u) => u.pathname === '/today');
  });

  test('signs in straight from the autofill suggestion (conditional UI)', async ({ page }) => {
    await addVirtualAuthenticator(page);
    const { username } = await signUpViaUi(page, name());
    await signOut(page);
    // The virtual authenticator answers the conditional request like a user picking the suggestion.
    await page.goto('/login');
    await page.waitForURL(/\/today/);
    await expect(page.getByRole('heading', { name: `Hi, ${username}` })).toBeVisible();
  });

  test('requests passkeys through autofill (conditional UI)', async ({ page }) => {
    await page.addInitScript(() => {
      const original = navigator.credentials.get.bind(navigator.credentials);
      (window as unknown as { __mediations: string[] }).__mediations = [];
      navigator.credentials.get = (opts) => {
        (window as unknown as { __mediations: string[] }).__mediations.push(
          String(opts?.mediation),
        );
        return original(opts);
      };
    });
    await addVirtualAuthenticator(page);
    await page.goto('/login');
    await expect(page.getByLabel('Player name')).toHaveAttribute(
      'autocomplete',
      'username webauthn',
    );
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __mediations: string[] }).__mediations),
      )
      .toContain('conditional');
  });

  test('rotates the session token on sign-in and revokes it on sign-out', async ({
    page,
    context,
  }) => {
    await addVirtualAuthenticator(page);
    await signUpViaUi(page, name());
    const signupCookie = (await sessionCookie(page))!;
    await page.goto('/login'); // already signed in → redirected
    await page.waitForURL(/\/today/);

    await signOut(page);
    expect(await sessionCookie(page)).toBeUndefined();
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in with passkey' }).click();
    await page.waitForURL(/\/today/);
    const loginCookie = (await sessionCookie(page))!;
    expect(loginCookie.value).not.toBe(signupCookie.value);

    // Replaying the signed-out token gets you nowhere.
    await context.clearCookies({ name: loginCookie.name });
    await context.addCookies([{ ...signupCookie }]);
    await page.goto('/today');
    await page.waitForURL(/\/login/);
  });

  test('works with more than one passkey (platform + security key)', async ({ page }) => {
    const laptop = await addVirtualAuthenticator(page);
    const { username } = await signUpViaUi(page, name());
    // Later, on a security key: add it as a second passkey while signed in.
    await laptop.remove();
    const key = await addVirtualAuthenticator(page, 'usb');
    await page.goto('/login/add-passkey?next=/today');
    await page.getByRole('button', { name: 'Add a passkey' }).click();
    await page.waitForURL((u) => u.pathname === '/today');
    expect(await key.credentials()).toHaveLength(1);

    const sql = e2eSql();
    const rows =
      await sql`SELECT c.nickname, c.transports FROM passkey_credentials c JOIN users u ON u.id = c.user_id WHERE u.username = ${username} ORDER BY c.created_at`;
    await sql.end();
    expect(rows).toHaveLength(2);
    expect(rows[1]!.nickname).toBe('Security key');

    await signOut(page);
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in with passkey' }).click();
    await page.waitForURL((u) => u.pathname === '/today');
  });

  test('cannot add the same authenticator twice', async ({ page }) => {
    await addVirtualAuthenticator(page);
    await signUpViaUi(page, name());
    await page.goto('/login/add-passkey?next=/today');
    await page.getByRole('button', { name: 'Add a passkey' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /already/ })).toBeVisible();
  });

  test('rejects a passkey the account no longer has', async ({ page }) => {
    await addVirtualAuthenticator(page);
    const { username } = await signUpViaUi(page, name());
    await signOut(page);
    const sql = e2eSql();
    await sql`DELETE FROM passkey_credentials WHERE user_id = (SELECT id FROM users WHERE username = ${username})`;
    await sql.end();
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in with passkey' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: "We don't recognise that passkey" }),
    ).toBeVisible();
  });
});

test.describe('password sign-in', () => {
  const PASSWORD = 'quiet maple lantern river';

  async function withPassword(page: Page) {
    await addVirtualAuthenticator(page);
    const { username } = await signUpViaUi(page, name());
    const res = await page.request.put('/api/me/password', {
      data: { password: PASSWORD },
      headers: await csrfHeaders(page),
    });
    expect(res.status()).toBe(200);
    await signOut(page);
    return username;
  }

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
  });

  test('signs in with name and password and offers a passkey for this device', async ({ page }) => {
    test.slow(); // argon2id is deliberately slow under parallel load
    const username = await withPassword(page);
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in with a password' }).click();
    // Names are case-insensitive.
    await page.getByLabel('Player name for password sign-in').fill(username.toUpperCase());
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible({
      timeout: 45_000,
    });
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.waitForURL(/\/today/);
    const sql = e2eSql();
    const [s] = await sql`SELECT method FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE u.username = ${username} ORDER BY s.created_at DESC LIMIT 1`;
    await sql.end();
    expect(s!.method).toBe('password');
  });

  test('locks out after repeated wrong passwords, even for the right one', async ({ page }) => {
    const username = await withPassword(page);
    await page.goto('/login');
    const codes: string[] = [];
    for (let i = 0; i < 5; i++)
      codes.push(
        (
          await (
            await apiPost(page, '/api/auth/login/password', {
              username,
              password: 'wrong-guess-12',
            })
          ).json()
        ).error.code,
      );
    expect(codes).toEqual(Array(5).fill('login_failed'));
    const locked = await apiPost(page, '/api/auth/login/password', {
      username,
      password: PASSWORD,
    });
    expect(locked.status()).toBe(429);
    expect((await locked.json()).error.code).toBe('locked');
    expect(Number(locked.headers()['retry-after'])).toBeGreaterThan(30);
  });

  test('gives the same answer for unknown names and accounts without a password', async ({
    page,
  }) => {
    await page.goto('/login');
    const unknown = await apiPost(page, '/api/auth/login/password', {
      username: 'nobody_here_42',
      password: PASSWORD,
    });
    expect(unknown.status()).toBe(401);
    expect((await unknown.json()).error.code).toBe('login_failed');

    await addVirtualAuthenticator(page);
    const { username } = await signUpViaUi(page, name());
    await signOut(page);
    await page.goto('/login');
    const noPassword = await apiPost(page, '/api/auth/login/password', {
      username,
      password: PASSWORD,
    });
    expect(noPassword.status()).toBe(401);
    expect((await noPassword.json()).error.code).toBe('login_failed');
  });
});
