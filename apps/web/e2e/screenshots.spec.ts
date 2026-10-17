import type { Page } from '@playwright/test';
import { fillConfirmation, signUpViaUi, solveGateInUi } from './support/auth';
import { addVirtualAuthenticator, expect, randomIp, test } from './support/fixtures';
import { THEMES, VIEWPORTS, capture, shotsDir } from './support/shots';

/**
 * Review captures. Run with:
 *   SHOTS_DIR=../../docs/screenshots/<branch> SHOTS_SET=<set> pnpm exec playwright test --project screenshots
 * Each screen: a route plus optional setup that puts the page into a state.
 */
interface Screen {
  name: string;
  path: string;
  setup?: (page: Page) => Promise<void>;
  /** Capture the viewport only (overlays, sheets) instead of the full page. */
  viewportOnly?: boolean;
}

async function toPasskeyStep(page: Page) {
  await expect(page.getByLabel('Available')).toBeVisible();
  await page.getByRole('button', { name: "That's me" }).click();
  await solveGateInUi(page);
  await expect(page.getByRole('button', { name: 'Create passkey' })).toBeVisible();
}

async function toPhraseStep(page: Page) {
  await addVirtualAuthenticator(page);
  await toPasskeyStep(page);
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(page.getByTestId('recovery-phrase').locator('[data-word]')).toHaveCount(6);
}

async function signedIn(page: Page) {
  await addVirtualAuthenticator(page);
  await signUpViaUi(page);
}

const noAutofill = async (page: Page) => {
  await page.addInitScript(() => {
    PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  });
  await page.reload();
};

/** Starts a pairing request in a separate "laptop" context and returns its approval path. */
async function pendingPairing(page: Page) {
  const ctx = await page
    .context()
    .browser()!
    .newContext({ extraHTTPHeaders: { 'x-forwarded-for': randomIp() } });
  const laptop = await ctx.newPage();
  await laptop.goto('/login/pair');
  await expect(laptop.getByTestId('pair-number')).toBeVisible();
  const number = Number(await laptop.getByTestId('pair-number').innerText());
  const path = new URL(await laptop.getByTestId('pair-url').innerText()).pathname;
  return { number, path, close: () => ctx.close() };
}

const SETS: Record<string, Screen[]> = {
  styleguide: [
    { name: 'styleguide', path: '/styleguide' },
    {
      name: 'styleguide-dialog',
      path: '/styleguide',
      viewportOnly: true,
      setup: async (page) => {
        await page.getByRole('button', { name: 'Open dialog' }).click();
        await page.getByRole('dialog').waitFor();
      },
    },
    {
      name: 'styleguide-toasts',
      path: '/styleguide',
      viewportOnly: true,
      setup: async (page) => {
        await page.getByRole('button', { name: 'Success toast' }).click();
        await page.getByRole('button', { name: 'Error toast' }).click();
      },
    },
  ],
  login: [
    { name: 'login', path: '/login', setup: noAutofill },
    {
      name: 'login-error',
      path: '/login',
      setup: async (page) => {
        await page.addInitScript(() => {
          PublicKeyCredential.isConditionalMediationAvailable = async () => false;
          navigator.credentials.get = () =>
            Promise.reject(new DOMException('cancelled', 'NotAllowedError'));
        });
        await page.reload();
        await page.getByRole('button', { name: 'Sign in with passkey' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'passkey prompt' })).toBeVisible();
      },
    },
    { name: 'recover', path: '/login/recover' },
    {
      name: 'recover-error',
      path: '/login/recover',
      setup: async (page) => {
        await page
          .getByLabel('Player name')
          .fill(`someone_${Math.random().toString(36).slice(2, 7)}`);
        await page.getByLabel('Recovery phrase').fill('abandon ability able about above absent');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('alert').filter({ hasText: "don't match" })).toBeVisible({
          timeout: 20_000,
        });
      },
    },
    {
      name: 'add-passkey',
      path: '/',
      setup: async (page) => {
        await signedIn(page);
        await page.goto('/login/add-passkey?next=/today');
        await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible();
      },
    },
  ],
  pairing: [
    {
      name: 'pair-new-device',
      path: '/login/pair',
      setup: async (page) => {
        await expect(page.getByTestId('pair-number')).toBeVisible();
      },
    },
    {
      name: 'pair-approve',
      path: '/',
      setup: async (page) => {
        await signedIn(page);
        const p = await pendingPairing(page);
        await page.goto(p.path);
        await expect(page.getByRole('heading', { name: 'Approve a sign-in?' })).toBeVisible();
      },
    },
    {
      name: 'pair-approved',
      path: '/',
      setup: async (page) => {
        await signedIn(page);
        const p = await pendingPairing(page);
        await page.goto(p.path);
        await page.getByRole('button', { name: String(p.number), exact: true }).click();
        await expect(page.getByText('Approved', { exact: true })).toBeVisible();
      },
    },
    {
      name: 'pair-wrong-number',
      path: '/',
      setup: async (page) => {
        await signedIn(page);
        const p = await pendingPairing(page);
        await page.goto(p.path);
        const wrong = (await page.getByRole('group').getByRole('button').allInnerTexts())
          .map(Number)
          .find((n) => n !== p.number)!;
        await page.getByRole('button', { name: String(wrong), exact: true }).click();
        await expect(page.getByText("That number didn't match")).toBeVisible();
      },
    },
    {
      name: 'pair-declined-new-device',
      path: '/login/pair',
      setup: async (page) => {
        await page.route('**/api/auth/pair/status', (r) =>
          r.fulfill({ json: { status: 'denied' } }),
        );
        await expect(page.getByText('The request was declined on your other device.')).toBeVisible({
          timeout: 10_000,
        });
      },
    },
  ],
  signup: [
    { name: 'landing', path: '/' },
    {
      name: 'start-1-name',
      path: '/start',
      setup: async (page) => {
        await expect(page.getByLabel('Available')).toBeVisible();
      },
    },
    {
      name: 'start-1-name-error',
      path: '/start',
      setup: async (page) => {
        await page.getByLabel('Player name').fill('admin');
        await expect(page.getByRole('alert')).toBeVisible();
      },
    },
    {
      name: 'start-1-name-long',
      path: '/start',
      setup: async (page) => {
        await page.getByLabel('Player name').fill('supercalifragilistic');
        await expect(page.getByLabel(/Available|Not available/)).toBeVisible();
      },
    },
    {
      name: 'start-2-gate',
      path: '/start',
      setup: async (page) => {
        await expect(page.getByLabel('Available')).toBeVisible();
        await page.getByRole('button', { name: "That's me" }).click();
        const tiles = page.getByTestId('puzzle-gate').getByRole('button', { name: /^Letter/ });
        await expect(tiles.first()).toBeVisible();
        await tiles.nth(0).click();
        await tiles.nth(1).click();
      },
    },
    { name: 'start-3-passkey', path: '/start', setup: toPasskeyStep },
    {
      name: 'start-3-passkey-error',
      path: '/start',
      setup: async (page) => {
        await page.addInitScript(() => {
          navigator.credentials.create = () =>
            Promise.reject(new DOMException('cancelled', 'NotAllowedError'));
        });
        await page.reload();
        await toPasskeyStep(page);
        await page.getByRole('button', { name: 'Create passkey' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'passkey prompt' })).toBeVisible();
      },
    },
    { name: 'start-4-phrase', path: '/start', setup: toPhraseStep },
    {
      name: 'start-5-confirm-error',
      path: '/start',
      setup: async (page) => {
        await toPhraseStep(page);
        await page.getByLabel('I saved my recovery phrase somewhere safe').check();
        await page.getByRole('button', { name: 'Continue' }).click();
        await fillConfirmation(page, Array(6).fill('zebra'));
        await page.getByRole('button', { name: 'Finish' }).click();
        await expect(page.getByRole('alert').filter({ hasText: "don't match" })).toBeVisible();
      },
    },
  ],
};

const set = process.env.SHOTS_SET ?? 'styleguide';
const SCREENS = SETS[set] ?? [];

test.skip(!shotsDir(), 'set SHOTS_DIR to capture review screenshots');

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const screen of SCREENS) {
      test(`${screen.name} · ${vp.name} · ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(screen.path);
        if (screen.setup) await screen.setup(page);
        await capture(page, `${screen.name}--${vp.name}--${theme}`, {
          fullPage: !screen.viewportOnly,
        });
      });
    }
  }
}
