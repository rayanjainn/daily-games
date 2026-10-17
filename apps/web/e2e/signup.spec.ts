import AxeBuilder from '@axe-core/playwright';
import { addVirtualAuthenticator, expect, test } from './support/fixtures';
import { apiPost, fillConfirmation, gateAnswer, signUpViaUi, solveGateInUi } from './support/auth';

const uniqueName = () => `tester_${Math.random().toString(36).slice(2, 8)}`;

test.describe('sign-up', () => {
  test('completes the full flow with a virtual passkey', async ({ page }) => {
    const auth = await addVirtualAuthenticator(page);
    const { username, phrase } = await signUpViaUi(page, uniqueName());
    expect(phrase).toHaveLength(6);
    await expect(page.getByRole('heading', { name: `Hi, ${username}` })).toBeVisible();

    const creds = await auth.credentials();
    expect(creds).toHaveLength(1);
    expect(creds[0]!.isResidentCredential).toBe(true);
  });

  test('suggests an available adjective_noun_number name', async ({ page }) => {
    await page.goto('/start');
    await expect(page.getByLabel('Player name')).toHaveValue(/^[a-z]+_[a-z]+_\d{2}$/);
    await expect(page.getByLabel('Available')).toBeVisible();
    const before = await page.getByLabel('Player name').inputValue();
    await page.getByRole('button', { name: 'Shuffle' }).click();
    await expect(page.getByLabel('Player name')).not.toHaveValue(before);
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

  test('a wrong gate answer shakes and lets you retry', async ({ page }) => {
    await page.goto('/start');
    await expect(page.getByLabel('Available')).toBeVisible();
    await page.getByRole('button', { name: "That's me" }).click();
    const gate = page.getByTestId('puzzle-gate');
    const tiles = gate.getByRole('button', { name: /^Letter [A-Z]$/ });
    await expect(tiles.first()).toBeVisible();
    const letters = (await tiles.allInnerTexts()).map((t) => t.trim());
    // Type the letters in the scrambled order: guaranteed wrong.
    await page.keyboard.type(letters.join('').toLowerCase(), { delay: 30 });
    await expect(gate.getByText('Not quite. Try again!')).toBeVisible();
    await expect(gate.getByRole('status', { name: 'Your answer: empty' })).toBeVisible();
    await page.keyboard.type(gateAnswer(letters).toLowerCase(), { delay: 30 });
    await expect(page.getByRole('heading', { name: 'Create your passkey' })).toBeVisible();
  });

  test('cancelling the passkey prompt shows a friendly error and allows retry', async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    // Browsers reject with NotAllowedError when the user dismisses the OS prompt.
    await page.addInitScript(() => {
      const original = navigator.credentials.create.bind(navigator.credentials);
      let calls = 0;
      navigator.credentials.create = (opts) =>
        calls++ === 0
          ? Promise.reject(new DOMException('cancelled', 'NotAllowedError'))
          : original(opts);
    });
    await page.goto('/start');
    await expect(page.getByLabel('Available')).toBeVisible();
    await page.getByRole('button', { name: "That's me" }).click();
    await solveGateInUi(page);
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'The passkey prompt was closed or timed out' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByRole('heading', { name: 'Save your recovery phrase' })).toBeVisible();
  });

  test('the recovery check rejects wrong words', async ({ page }) => {
    await addVirtualAuthenticator(page);
    await page.goto('/start');
    await page.getByLabel('Player name').fill(uniqueName());
    await expect(page.getByLabel('Available')).toBeVisible();
    await page.getByRole('button', { name: "That's me" }).click();
    await solveGateInUi(page);
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByTestId('recovery-phrase').locator('[data-word]')).toHaveCount(6);
    const words = await page.getByTestId('recovery-phrase').locator('[data-word]').allInnerTexts();
    await page.getByLabel('I saved my recovery phrase somewhere safe').check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await fillConfirmation(
      page,
      words.map(() => 'zebra'),
    );
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: "Those words don't match" }),
    ).toBeVisible();
    await fillConfirmation(page, words);
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.waitForURL(/\/today/);
  });

  test('has no axe violations on each step', async ({ page }) => {
    await addVirtualAuthenticator(page);
    await page.goto('/start');
    await expect(page.getByLabel('Available')).toBeVisible();
    const check = async () => {
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    };
    await check();
    await page.getByRole('button', { name: "That's me" }).click();
    await expect(
      page
        .getByTestId('puzzle-gate')
        .getByRole('button', { name: /^Letter/ })
        .first(),
    ).toBeVisible();
    await check();
    await solveGateInUi(page);
    await expect(page.getByRole('button', { name: 'Create passkey' })).toBeVisible();
    await check();
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByTestId('recovery-phrase')).toBeVisible();
    await check();
  });
});

test.describe('sign-up bot protection (API level, puzzle UI bypassed)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/start');
  });

  test('requires a gate pass', async ({ page }) => {
    const pow = await (await apiPost(page, '/api/auth/pow', {})).json();
    const res = await apiPost(page, '/api/auth/signup/options', {
      username: uniqueName(),
      gatePass: 'forged.token',
      pow: { id: pow.id, nonce: '0' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('gate_required');
  });

  test('requires a valid, single-use proof of work even with a real gate pass', async ({
    page,
  }) => {
    const gate = await (await apiPost(page, '/api/auth/gate/start', {})).json();
    const solved = await (
      await apiPost(page, '/api/auth/gate/solve', { id: gate.id, answer: gateAnswer(gate.letters) })
    ).json();
    expect(solved.pass).toBeTruthy();

    const pow = await (await apiPost(page, '/api/auth/pow', {})).json();
    const bad = await apiPost(page, '/api/auth/signup/options', {
      username: uniqueName(),
      gatePass: solved.pass,
      pow: { id: pow.id, nonce: '1' },
    });
    expect((await bad.json()).error.code).toBe('pow_invalid');

    // A correct solution for a challenge that was already consumed is still rejected.
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
    const replay = await apiPost(page, '/api/auth/signup/options', {
      username: uniqueName(),
      gatePass: solved.pass,
      pow: { id: pow.id, nonce },
    });
    expect((await replay.json()).error.code).toBe('pow_invalid');

    const fresh = await (await apiPost(page, '/api/auth/pow', {})).json();
    const freshNonce = await page.evaluate(async ({ salt, difficulty }) => {
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
    }, fresh);
    const ok = await apiPost(page, '/api/auth/signup/options', {
      username: uniqueName(),
      gatePass: solved.pass,
      pow: { id: fresh.id, nonce: freshNonce },
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).options.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    });
  });

  test('a gate pass is bound to the device that earned it', async ({ page, browser }) => {
    const gate = await (await apiPost(page, '/api/auth/gate/start', {})).json();
    const { pass } = await (
      await apiPost(page, '/api/auth/gate/solve', { id: gate.id, answer: gateAnswer(gate.letters) })
    ).json();
    const other = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': '10.201.0.1' },
    });
    const p2 = await other.newPage();
    await p2.goto('/start');
    const pow = await (await apiPost(p2, '/api/auth/pow', {})).json();
    const res = await apiPost(p2, '/api/auth/signup/options', {
      username: uniqueName(),
      gatePass: pass,
      pow: { id: pow.id, nonce: '0' },
    });
    expect((await res.json()).error.code).toBe('gate_required');
    await other.close();
  });

  test('gate allows three tries per puzzle', async ({ page }) => {
    const gate = await (await apiPost(page, '/api/auth/gate/start', {})).json();
    const codes = [];
    for (let i = 0; i < 3; i++)
      codes.push(
        (
          await (
            await apiPost(page, '/api/auth/gate/solve', { id: gate.id, answer: 'XXXXX' })
          ).json()
        ).error.code,
      );
    expect(codes).toEqual(['gate_wrong', 'gate_wrong', 'gate_too_many']);
    const after = await apiPost(page, '/api/auth/gate/solve', {
      id: gate.id,
      answer: gateAnswer(gate.letters),
    });
    expect((await after.json()).error.code).toBe('gate_expired');
  });

  test('rate-limits sign-up attempts per IP', async ({ page }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push(
        (
          await apiPost(page, '/api/auth/signup/options', {
            username: uniqueName(),
            gatePass: 'x',
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
