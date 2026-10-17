import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** Reads the CSRF cookie the app set and returns the header our API expects. */
export async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name.endsWith('ed_csrf'))?.value ?? '';
  return {
    'x-csrf-token': token,
    origin: new URL(page.url()).origin,
    'content-type': 'application/json',
  };
}

export async function apiPost(
  page: Page,
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) {
  return page.request.post(path, {
    data: body,
    headers: { ...(await csrfHeaders(page)), ...extra },
  });
}

/** Like apiPost, for PATCH and DELETE. */
export async function apiSend(page: Page, method: 'PATCH' | 'DELETE', path: string, body: unknown) {
  return page.request.fetch(path, { method, data: body, headers: await csrfHeaders(page) });
}

/** Completes the whole sign-up wizard in the UI and returns the recovery phrase. */
export async function signUpViaUi(
  page: Page,
  username?: string,
): Promise<{ username: string; phrase: string[] }> {
  await page.goto('/start');
  const input = page.getByLabel('Player name');
  if (username) await input.fill(username);
  const name = await input.inputValue();
  await expect(page.getByLabel('Available')).toBeVisible();
  await page.getByRole('button', { name: "That's me" }).click();

  await solveGateInUi(page);

  await page.getByRole('button', { name: 'Create passkey' }).click();
  const words = page.getByTestId('recovery-phrase').locator('[data-word]');
  await expect(words).toHaveCount(6);
  const phrase = await words.allInnerTexts();

  await page.getByLabel('I saved my recovery phrase somewhere safe').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await fillConfirmation(page, phrase);
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.waitForURL(/\/today/);
  return { username: name, phrase };
}

/**
 * The gate answer isn't exposed to the page. Tests read it the way a bot would: by trying the
 * permutations through the API isn't allowed (3 tries), so instead we brute-force locally from
 * the word list the server uses, which is exactly why the gate is not bot protection.
 */
const GATE_WORDS = [
  'TILES',
  'STREAK',
  'PUZZLE',
  'DAILY',
  'CLUES',
  'GRIDS',
  'WORDS',
  'SOLVE',
  'GUESS',
  'BOARD',
  'SCORE',
  'MATCH',
];

export function gateAnswer(letters: string[]): string {
  const key = [...letters].sort().join('');
  const hit = GATE_WORDS.find((w) => w.split('').sort().join('') === key);
  if (!hit) throw new Error(`no gate word for ${letters.join('')}`);
  return hit;
}

export async function solveGateInUi(page: Page) {
  const gate = page.getByTestId('puzzle-gate');
  await expect(gate).toBeVisible();
  const tiles = gate.getByRole('button', { name: /^Letter [A-Z]$/ });
  await expect(tiles.first()).toBeVisible();
  const letters = (await tiles.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.type(gateAnswer(letters).toLowerCase(), { delay: 40 });
}

/** Fills whichever two "Word #N" fields the confirmation step asks for. */
export async function fillConfirmation(page: Page, phrase: string[]) {
  await expect(page.getByRole('heading', { name: 'Quick check' })).toBeVisible();
  for (let n = 1; n <= 6; n++) {
    const field = page.getByLabel(`Word #${n}`, { exact: true });
    if (await field.count()) await field.fill(phrase[n - 1]!);
  }
}
