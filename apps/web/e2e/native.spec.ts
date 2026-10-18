import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { cipherAnswer, makeItAnswer, scrambleAnswer } from './support/native';
import { signInAs } from './support/session';

async function puzzleNumber(page: Page) {
  const text = await page.getByTestId('native-puzzle').innerText();
  return Number(text.replace(/\D/g, ''));
}

const SYMBOL_NAMES = [
  'Orange circle',
  'Blue square',
  'Green triangle',
  'Yellow diamond',
  'Purple star',
  'Pink cross',
];

async function guessCipher(page: Page, code: number[]) {
  for (const s of code) await page.getByRole('button', { name: `Add ${SYMBOL_NAMES[s]}` }).click();
  await page.getByRole('button', { name: 'Check guess' }).click();
}

async function player(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = await signInAs(page);
  return { ctx, page, user };
}

test.describe('native games', () => {
  test('Cipher: guesses are scored by the server, and cracking it saves the result', async ({
    page,
  }) => {
    await signInAs(page);
    await page.goto('/games/cipher/play');
    const n = await puzzleNumber(page);
    const code = cipherAnswer(n);

    // A guess that is certainly wrong somewhere: the server scores it, the code never shows.
    const wrong = code.map((s) => (s + 1) % 6);
    await guessCipher(page, wrong);
    const first = page.getByTestId('cipher-row').first();
    await expect(first.getByRole('img', { name: /in the right place/ })).toBeVisible();
    await expect(page.getByTestId('cipher-code')).toHaveCount(0);

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await guessCipher(page, code);
    await expect(page.getByTestId('native-summary')).toHaveText('2/8');
    const share = await page.getByTestId('native-share').innerText();
    expect(share).toMatch(/^Cipher [\d,]+ 2\/8\n\n/);
    expect(share).toContain('🟩🟩🟩🟩');
    // Reload: the finished game is still there, and no more moves are taken.
    await page.reload();
    await expect(page.getByTestId('native-summary')).toHaveText('2/8');
    const again = await apiPost(page, '/api/native/cipher', { action: 'guess', guess: code });
    expect(again.status()).toBe(409);

    // The result is a normal result: Today and the game page show it.
    await page.goto('/games/cipher');
    await expect(page.getByTestId('logged-today')).toContainText('Done: 2/8');
    await expect(page.getByTestId('global-board')).toContainText('2/8');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('Cipher: eight wrong guesses end the game and reveal the code', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/cipher/play');
    const n = await puzzleNumber(page);
    const code = cipherAnswer(n);
    const wrong = code.map((s) => (s + 1) % 6);
    for (let i = 0; i < 8; i++) {
      const res = await apiPost(page, '/api/native/cipher', { action: 'guess', guess: wrong });
      expect(res.status()).toBe(200);
      const view = await res.json();
      expect(view.finished).toBe(i === 7);
      // Until the end the code is never in the response.
      if (i < 7) expect(JSON.stringify(view)).not.toContain('"code":[');
    }
    await page.reload();
    await expect(page.getByTestId('native-summary')).toHaveText('X/8');
    await expect(page.getByTestId('cipher-code')).toBeVisible();
  });

  test('Scramble: any real anagram counts, the clock is the server’s, five words finish it', async ({
    page,
  }) => {
    await signInAs(page);
    await page.goto('/games/scramble/play');
    const n = await puzzleNumber(page);
    const { answers } = scrambleAnswer(n);
    await expect(page.getByTestId('scramble-word')).toHaveCount(5);

    const input = (i: number) => page.getByLabel(`Word ${i + 1}`);
    await input(0).fill('zzzzz');
    await page.getByRole('button', { name: 'Check' }).first().click();
    await expect(page.locator('main [role=alert]')).toContainText('Not a word that fits');

    for (const [i, w] of answers.entries()) {
      // The locked words drop out of the list, so the next open input is always the first.
      await page
        .getByLabel(/^Word \d/)
        .first()
        .fill(w);
      await page.getByRole('button', { name: 'Check' }).first().click();
      await expect(page.locator('[data-solved="true"]')).toHaveCount(i + 1);
    }
    await expect(page.getByTestId('native-summary')).toHaveText(/^\d+:\d\d$/);
    expect(await page.getByTestId('native-share').innerText()).toMatch(
      /^Scramble [\d,]+ \d+:\d\d\n🟩🟩🟩🟩🟩$/,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('Make It: the server checks the numbers and the total', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/make-it/play');
    const n = await puzzleNumber(page);
    const { numbers, target, solution } = makeItAnswer(n);
    await expect(page.getByTestId('target')).toHaveText(String(target));
    for (const num of numbers)
      await expect(
        page.getByRole('button', { name: new RegExp(`^Add ${num}`) }).first(),
      ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const box = page.getByLabel('Your expression');
    await box.fill(numbers.slice(0, 3).join('+'));
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('main [role=alert]')).toContainText('exactly once');
    await box.fill(numbers.join('+'));
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('main [role=alert]')).toContainText(/That makes \d+, not/);
    await box.fill('3 +');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('main [role=alert]')).toBeVisible();

    await box.fill(solution);
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByTestId('native-summary')).toHaveText(/^\d+:\d\d$/);
    await expect(page.getByText('3 tries so far')).toHaveCount(0);
  });

  test('results cannot be logged by hand or sent for other games, and need a session', async ({
    page,
    browser,
  }) => {
    const anon = await browser.newContext();
    const res = await anon.request.post(
      new URL('/api/native/cipher', test.info().project.use.baseURL).toString(),
      { data: { action: 'guess', guess: [0, 1, 2, 3] } },
    );
    expect([401, 403]).toContain(res.status());
    await anon.close();

    await signInAs(page);
    await page.goto('/games/cipher');
    // Pasting, typing in a score or ticking it off are all refused for a native game.
    const manual = await apiPost(page, '/api/results', {
      source: 'manual',
      slug: 'cipher',
      entry: { solved: true, attempts: 1 },
    });
    expect(manual.status()).toBe(422);
    expect((await manual.json()).error.code).toBe('play_here');
    expect(
      (await apiPost(page, '/api/results', { source: 'checkbox', slug: 'cipher' })).status(),
    ).toBe(422);
    expect(
      (
        await apiPost(page, '/api/results', {
          source: 'paste',
          slug: 'cipher',
          shareText: 'Cipher 1 1/8',
        })
      ).status(),
    ).toBe(422);

    // Not a native game, wrong move for the game, bad input.
    expect(
      (
        await apiPost(page, '/api/native/wordle', { action: 'guess', guess: [0, 1, 2, 3] })
      ).status(),
    ).toBe(404);
    expect(
      (
        await apiPost(page, '/api/native/cipher', { action: 'expression', expression: '1+1' })
      ).status(),
    ).toBe(400);
    expect(
      (
        await apiPost(page, '/api/native/cipher', { action: 'guess', guess: [0, 1, 2, 9] })
      ).status(),
    ).toBe(400);
    expect(
      (await apiPost(page, '/api/native/cipher', { action: 'guess', guess: [0, 1, 2] })).status(),
    ).toBe(400);
    expect(
      (
        await apiPost(page, '/api/native/scramble', { action: 'word', index: 7, guess: 'a' })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post('/api/native/cipher', {
          data: { action: 'guess', guess: [0, 1, 2, 3] },
        })
      ).status(),
    ).toBe(403);
  });

  test('the global board ranks verified results, and players can hide themselves', async ({
    browser,
  }) => {
    const a = await player(browser);
    const b = await player(browser);
    const c = await player(browser);
    for (const p of [a, b, c]) await p.page.goto('/games/cipher/play');
    const n = await puzzleNumber(a.page);
    const code = cipherAnswer(n);
    const wrong = code.map((s) => (s + 1) % 6);

    // a: first guess. b: second guess. c: third, and hides themselves.
    await apiPost(a.page, '/api/native/cipher', { action: 'guess', guess: code });
    await apiPost(b.page, '/api/native/cipher', { action: 'guess', guess: wrong });
    await apiPost(b.page, '/api/native/cipher', { action: 'guess', guess: code });
    await apiPost(c.page, '/api/native/cipher', { action: 'guess', guess: wrong });
    await apiPost(c.page, '/api/native/cipher', { action: 'guess', guess: wrong });
    await apiPost(c.page, '/api/native/cipher', { action: 'guess', guess: code });
    const sql = e2eSql();
    await sql`UPDATE users SET show_on_rankings = false WHERE id = ${c.user.id}`;
    await sql.end();

    await a.page.goto('/games/cipher');
    const board = a.page.getByTestId('global-board');
    const rows = board.getByRole('listitem');
    // Ranks come from the result, so a's 1/8 sits above b's 2/8; c is hidden from others.
    await expect(rows.first()).toBeVisible();
    const texts = await rows.allInnerTexts();
    const ia = texts.findIndex((t) => t.includes(`${a.user.username} (you)`));
    const ib = texts.findIndex((t) => t.includes(b.user.username));
    expect(ia).toBeGreaterThanOrEqual(0);
    expect(ib).toBeGreaterThan(ia);
    expect(texts.join('\n')).not.toContain(c.user.username);
    expect(texts[ia]).toContain('1/8');

    // They still see themselves.
    await c.page.goto('/games/cipher');
    await expect(c.page.getByTestId('global-board')).toContainText(`${c.user.username} (you)`);
    for (const p of [a, b, c]) await p.ctx.close();
  });

  test('native games show on Today as plain tiles that link to play', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/cipher');
    await page.getByRole('button', { name: 'Follow' }).click();
    await page.goto('/today');
    const row = page.getByTestId('checklist-item').filter({ hasText: 'Cipher' });
    await expect(row).toHaveCount(1);
    // No "log result" tick for a game that records itself; the Play button goes to the game.
    await expect(row.getByRole('button', { name: /^Log Cipher/ })).toHaveCount(0);
    await row.getByRole('link', { name: 'Play' }).click();
    await expect(page).toHaveURL(/\/games\/cipher\/play$/);

    const n = await puzzleNumber(page);
    await apiPost(page, '/api/native/cipher', { action: 'guess', guess: cipherAnswer(n) });
    await page.goto('/today');
    await expect(page.getByTestId('checklist-item').filter({ hasText: 'Cipher' })).toHaveAttribute(
      'data-done',
      'true',
    );
    await expect(page.getByTestId('points')).toContainText('100 pts today');
  });
});
