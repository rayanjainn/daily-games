import type { Page } from '@playwright/test';
import { fillConfirmation, signUpViaUi, solveGateInUi } from './support/auth';
import { addVirtualAuthenticator, expect, randomIp, test } from './support/fixtures';
import { e2eSql } from './support/db';
import { follow, played } from './support/play';
import { signInAs } from './support/session';
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

/** Fixed ids so parallel captures share one report and one suggestion in the queue. */
async function seedQueue() {
  const sql = e2eSql();
  await sql`INSERT INTO game_reports (id, game_id, kind, details)
    SELECT '00000000-0000-4000-8000-000000000001', id, 'wrong_reset',
      'It changes at 6 AM UTC now, not midnight. Saw it twice this week.'
    FROM games WHERE slug = 'flagle' ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO game_reports (id, game_id, kind, details)
    SELECT '00000000-0000-4000-8000-000000000002', id, 'moved', NULL
    FROM games WHERE slug = 'tradle' ON CONFLICT DO NOTHING`;
  const [u] = await sql`SELECT id FROM users LIMIT 1`;
  await sql`INSERT INTO game_submissions (id, submitted_by, url, normalized_key, name, category,
      reset_hint, sample_share_text, fetched_title, fetched_description, probe_result)
    VALUES ('00000000-0000-4000-8000-000000000003', ${u!.id}, 'https://example.com/hexbloom',
      'example.com/hexbloom', 'Hexbloom', 'logic', 'Midnight local time',
      ${'Hexbloom #212\n🟩🟩🟨⬜\nSolved in 4'}, 'Hexbloom: a daily hex puzzle',
      'Grow the flower by placing six hexes. New puzzle every day.',
      ${sql.json({ status: 200, verdict: 'blocked', reason: 'X-Frame-Options: DENY' })})
    ON CONFLICT DO NOTHING`;
  await sql.end();
}

async function wordleToday(): Promise<number> {
  const sql = e2eSql();
  const [r] = await sql`SELECT epoch_number + ((now() AT TIME ZONE 'UTC')::date - puzzle_epoch) AS n
    FROM games WHERE slug = 'wordle'`;
  await sql.end();
  return Number(r!.n);
}
const share = (n: number) =>
  `Wordle ${n.toLocaleString('en-US')} 4/6\n\n⬛🟨⬛⬛⬛\n⬛⬛🟩🟨⬛\n🟩⬛🟩⬛🟩\n🟩🟩🟩🟩🟩`;

/** About five months of Wordle with gaps, losses and a spread of scores. */
async function wordleHistory(userId: string) {
  const pattern = [4, 3, 5, 4, 0, 3, 4, 6, 2, 4, 5, 3];
  for (let d = 0; d < 150; d++) {
    if (d % 17 === 9 || d % 23 === 14) continue; // missed days
    const a = pattern[d % pattern.length]!;
    await played(
      userId,
      'wordle',
      [d],
      a === 0 ? { solved: false, maxAttempts: 6 } : { attempts: a, maxAttempts: 6 },
    );
  }
}

const SETS: Record<string, Screen[]> = {
  pwa: [
    { name: 'offline', path: '/offline' },
    {
      name: 'settings-install-prompt',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/settings');
        // Wait for hydration, so the listener exists before the event fires.
        await expect(page.getByTestId('install-app')).toHaveAttribute('data-mode', 'manual');
        await page.evaluate(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true });
          Object.assign(e, { prompt: async () => {}, userChoice: new Promise(() => {}) });
          window.dispatchEvent(e);
        });
        await expect(page.getByRole('button', { name: 'Install EveryDaily' })).toBeVisible();
        await page
          .getByRole('heading', { name: 'Install the app' })
          .evaluate((el) => el.scrollIntoView({ block: 'center' }));
      },
      viewportOnly: true,
    },
    {
      name: 'settings-install-ios',
      path: '/',
      setup: async (page) => {
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'userAgent', {
            get: () =>
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
          });
        });
        await signInAs(page);
        await page.goto('/settings');
        await expect(page.getByTestId('install-app')).toHaveAttribute('data-mode', 'ios');
        await page
          .getByRole('heading', { name: 'Install the app' })
          .evaluate((el) => el.scrollIntoView({ block: 'center' }));
      },
      viewportOnly: true,
    },
  ],
  stats: [
    {
      name: 'stats-wordle',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await wordleHistory(u.id);
        await page.goto('/games/wordle');
        await expect(page.getByTestId('distribution')).toBeVisible();
      },
    },
    {
      name: 'stats-mini-times',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        const times = [41, 58, 95, 33, 72, 64, 120, 47, 39, 88];
        for (const [i, t] of times.entries())
          await played(u.id, 'nyt-mini', [i + 1], { timeSeconds: t });
        await page.goto('/games/nyt-mini');
        await expect(page.getByTestId('distribution')).toBeVisible();
      },
    },
    {
      name: 'stats-checkoff',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await played(u.id, 'tradle', [0, 1, 2, 3, 5, 6, 9], { source: 'checkbox' });
        await page.goto('/games/tradle');
        await expect(page.getByTestId('heatmap')).toBeVisible();
      },
    },
  ],
  logging: [
    {
      name: 'log-paste-preview',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/wordle');
        await page.getByLabel('Your Wordle share text').fill(share(await wordleToday()));
        await expect(page.getByTestId('log-preview')).toBeVisible();
      },
    },
    {
      name: 'log-paste-error',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/wordle');
        await page.getByLabel('Your Wordle share text').fill(share((await wordleToday()) + 3));
        await expect(page.locator('#log-panel').getByRole('alert')).toBeVisible();
      },
    },
    {
      name: 'log-manual-time',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/nyt-mini');
        await page.getByRole('tab', { name: 'Enter score' }).click();
        await page.getByLabel('Time').fill('0:42');
      },
    },
    {
      name: 'log-checkoff',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/tradle');
        await expect(page.getByRole('button', { name: 'Mark today done' })).toBeVisible();
      },
    },
    {
      name: 'log-saved',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await played(u.id, 'wordle', [1, 2, 3]);
        await page.goto('/games/wordle');
        await page.getByLabel('Your Wordle share text').fill(share(await wordleToday()));
        await expect(page.getByTestId('log-preview')).toBeVisible();
        await page.locator('#log-panel').getByRole('button', { name: 'Save result' }).click();
        await expect(page.getByTestId('log-success')).toBeVisible();
      },
    },
    {
      name: 'log-already-logged',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await played(u.id, 'wordle', [0], { attempts: 3, maxAttempts: 6 });
        await page.goto('/games/wordle');
        await expect(page.getByTestId('logged-today')).toBeVisible();
      },
    },
    {
      name: 'log-popup-blocked',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.addInitScript(() => {
          window.open = () => null;
        });
        await page.goto('/games/wordle');
        await page.getByTestId('play-button').click();
        await expect(page.getByTestId('popup-blocked')).toBeVisible();
      },
    },
    {
      name: 'log-dashboard-sheet',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await follow(page, ['wordle', 'connections', 'tradle']);
        await page.goto('/today');
        await page.getByRole('button', { name: 'Log Wordle result' }).click();
        await page
          .getByRole('dialog')
          .getByLabel('Your Wordle share text')
          .fill(share(await wordleToday()));
        await expect(page.getByRole('dialog').getByTestId('log-preview')).toBeVisible();
      },
    },
  ],
  dashboard: [
    {
      name: 'today-empty',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/today');
        await expect(page.getByText('Build your daily lineup')).toBeVisible();
      },
    },
    {
      name: 'today-in-progress',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections', 'strands', 'nyt-mini', 'globle', 'flagle']);
        await played(u.id, 'wordle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], {
          attempts: 4,
          maxAttempts: 6,
        });
        await played(u.id, 'globle', [0, 1, 2], { solved: true });
        await played(u.id, 'flagle', [1, 2], { source: 'checkbox' });
        await page.goto('/today');
        await expect(page.getByTestId('checklist-item')).toHaveCount(6);
      },
    },
    {
      name: 'today-all-done',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'flagle']);
        await played(u.id, 'wordle', [0, 1], { solved: false, attempts: 6, maxAttempts: 6 });
        await played(u.id, 'flagle', [0], { source: 'checkbox' });
        await page.goto('/today');
        await expect(page.getByText('All done for today')).toBeVisible();
      },
    },
    {
      name: 'today-at-risk',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['connections', 'sedecordle', 'connections-sports']);
        await played(u.id, 'connections', [1, 2, 3, 4, 5]);
        await page.goto('/today');
        await expect(page.getByText(/keep your 5-day streak/)).toBeVisible();
      },
    },
    {
      name: 'today-reorder',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await follow(page, ['wordle', 'connections', 'strands']);
        await page.goto('/today');
        await page.getByRole('button', { name: 'Reorder' }).click();
      },
    },
  ],
  catalog: [
    {
      name: 'catalog',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games');
        await expect(page.getByTestId('game-card').first()).toBeVisible();
      },
    },
    {
      name: 'catalog-search',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games?q=ordle');
        await expect(page.getByTestId('game-card').first()).toBeVisible();
      },
    },
    {
      name: 'catalog-filtered',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games?category=geography&difficulty=easy');
        await expect(page.getByTestId('game-card').first()).toBeVisible();
      },
    },
    {
      name: 'catalog-no-match',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games?q=zzzz');
        await expect(page.getByText('No games match')).toBeVisible();
      },
    },
    {
      name: 'catalog-following-empty',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games?following=1');
        await expect(page.getByText('Nothing followed yet')).toBeVisible();
      },
    },
    {
      name: 'game-wordle',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/wordle');
        await expect(page.getByTestId('attribution')).toBeVisible();
      },
    },
    {
      name: 'game-mini-fixed-reset',
      path: '/',
      setup: async (page) => {
        await signInAs(page, { timezone: 'Asia/Kolkata' });
        await page.goto('/games/nyt-mini');
        await expect(page.getByTestId('attribution')).toBeVisible();
      },
    },
    {
      name: 'game-long-name',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/connections-sports');
        await expect(page.getByTestId('attribution')).toBeVisible();
      },
    },
    {
      name: 'game-report',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/flagle');
        await page.getByRole('button', { name: 'Report a problem' }).click();
        await page
          .getByRole('dialog')
          .getByLabel(/Wrong reset time/)
          .check();
      },
    },
    {
      name: 'suggest-errors',
      path: '/',
      setup: async (page) => {
        await signInAs(page, { role: 'mod' });
        await page.goto('/games/suggest');
        await page.getByRole('button', { name: 'Send suggestion' }).click();
        await expect(page.getByText('What is the game called?')).toBeVisible();
      },
    },
    {
      name: 'admin-queue',
      path: '/',
      setup: async (page) => {
        await signInAs(page, { role: 'mod' });
        await seedQueue();
        await page.goto('/admin');
        await expect(page.getByTestId('submission').first()).toBeVisible();
      },
    },
    {
      name: 'admin-games',
      path: '/',
      setup: async (page) => {
        await signInAs(page, { role: 'mod' });
        await page.goto('/admin/games');
        await page.getByLabel('Filter games').fill('nyt');
      },
    },
    {
      name: 'admin-game-editor-issues',
      path: '/',
      setup: async (page) => {
        await signInAs(page, { role: 'mod' });
        await page.goto('/admin/games/tradle');
        await page.getByLabel('Tier', { exact: true }).selectOption('2');
        await expect(page.getByTestId('rule-issues')).toBeVisible();
      },
    },
  ],
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
  settings: [
    {
      name: 'settings',
      path: '/',
      setup: async (page) => {
        await signedIn(page);
        await page.goto('/settings');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      },
    },
    {
      name: 'settings-new-phrase',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signedIn(page);
        await page.goto('/settings');
        await page.getByRole('button', { name: 'Make a new phrase' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Make a new phrase' }).click();
        await expect(page.getByTestId('new-recovery-phrase').locator('[data-word]')).toHaveCount(6);
      },
    },
    {
      name: 'settings-remove-last',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signedIn(page);
        await page.goto('/settings');
        await page.getByRole('button', { name: /^Remove / }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
        await expect(
          page.getByRole('dialog').getByText('This is your last passkey.'),
        ).toBeVisible();
      },
    },
    {
      name: 'settings-delete',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signedIn(page);
        await page.goto('/settings');
        await page.getByRole('button', { name: 'Delete account' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
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
