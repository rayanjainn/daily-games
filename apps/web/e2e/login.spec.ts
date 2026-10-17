import { signUpViaUi, apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { addVirtualAuthenticator, expect, test, type Page } from './support/fixtures';

const name = () => `login_${Math.random().toString(36).slice(2, 8)}`;

async function signOut(page: Page) {
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

test.describe('recovery phrase sign-in', () => {
  test('signs in with the phrase and offers to add a passkey', async ({ page }) => {
    const device = await addVirtualAuthenticator(page);
    const { username, phrase } = await signUpViaUi(page, name());
    await signOut(page);
    // The device with the passkey is gone; only the phrase is left.
    await device.remove();
    await page.goto('/login');
    await page.getByRole('link', { name: 'Use my recovery phrase' }).click();
    await page.getByLabel('Player name').fill(username.toUpperCase());
    // Four-letter prefixes and odd spacing are accepted.
    await page
      .getByLabel('Recovery phrase')
      .fill(`  ${phrase.map((w) => w.slice(0, 4)).join('   ')}  `);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // argon2id (64 MiB, 3 passes) is deliberately slow; under a parallel test load it can take a while.
    await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.waitForURL(/\/today/);
  });

  test('locks out after repeated wrong phrases, even for the right phrase', async ({ page }) => {
    await addVirtualAuthenticator(page);
    const { username, phrase } = await signUpViaUi(page, name());
    await signOut(page);
    await page.goto('/login/recover');
    const wrong = 'abandon ability able about above absent';
    const codes: string[] = [];
    for (let i = 0; i < 5; i++)
      codes.push(
        (await (await apiPost(page, '/api/auth/recover', { username, phrase: wrong })).json()).error
          .code,
      );
    expect(codes).toEqual(Array(5).fill('recovery_failed'));
    const locked = await apiPost(page, '/api/auth/recover', { username, phrase: phrase.join(' ') });
    expect(locked.status()).toBe(429);
    expect((await locked.json()).error.code).toBe('locked');
    expect(Number(locked.headers()['retry-after'])).toBeGreaterThan(30);
  });

  test('gives the same answer for unknown names and wrong phrases', async ({ page }) => {
    await page.goto('/login/recover');
    const unknown = await apiPost(page, '/api/auth/recover', {
      username: 'nobody_here_42',
      phrase: 'abandon ability able about above absent',
    });
    expect(unknown.status()).toBe(401);
    expect((await unknown.json()).error.code).toBe('recovery_failed');
  });

  test('rejects malformed phrases without revealing anything', async ({ page }) => {
    await page.goto('/login/recover');
    const res = await apiPost(page, '/api/auth/recover', {
      username: 'whoever',
      phrase: 'not a real phrase at all here',
    });
    expect((await res.json()).error.code).toBe('recovery_failed');
  });
});
