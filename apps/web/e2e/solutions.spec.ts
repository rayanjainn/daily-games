import { randomBytes } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { apiPost } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

async function todayNumber(slug: string): Promise<number> {
  const sql = e2eSql();
  const [r] = await sql`SELECT epoch_number + ((now() AT TIME ZONE 'UTC')::date - puzzle_epoch) AS n
    FROM games WHERE slug = ${slug}`;
  await sql.end();
  return Number(r!.n);
}

test.describe("yesterday's answer", () => {
  test('is shared, moderated, then revealed to other players', async ({ page, browser }) => {
    const answer = `Answer ${randomBytes(4).toString('hex')}: Mongolia`;
    await signInAs(page);
    await page.goto('/games/tradle');
    const card = page.getByRole('region', { name: "Yesterday's answer" });
    await expect(card).toContainText('No answer has been shared for this puzzle yet.');
    await card.getByRole('button', { name: 'Share the answer' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Answer').fill(answer);
    await dialog.getByLabel("Where it's published").fill('https://example.org/tradle/answers');
    await dialog.getByRole('button', { name: 'Send for review' }).click();
    await expect(card.getByTestId('solution-mine')).toContainText('waiting for a moderator');

    // Another player sees nothing until a moderator approves it.
    const otherCtx = await browser.newContext();
    const other = await otherCtx.newPage();
    await signInAs(other);
    await other.goto('/games/tradle');
    const otherCard = other.getByRole('region', { name: "Yesterday's answer" });
    await expect(otherCard).not.toContainText(answer);

    const modCtx = await browser.newContext();
    const mod = await modCtx.newPage();
    await signInAs(mod, { role: 'mod' });
    await mod.goto('/admin');
    const row = mod
      .getByRole('region', { name: /Answers/ })
      .getByRole('listitem')
      .filter({ hasText: answer });
    await expect(row).toContainText('https://example.org/tradle/answers');
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(row).toHaveCount(0);

    await other.reload();
    const reveal = otherCard.getByTestId('solution');
    await expect(reveal.getByText(answer)).toBeHidden();
    await reveal.getByText('Reveal the answer').click();
    await expect(reveal.getByText(answer)).toBeVisible();
    await expect(reveal.getByRole('link', { name: 'Source: example.org' })).toHaveAttribute(
      'rel',
      /nofollow/,
    );
    expect(
      (await new AxeBuilder({ page: other }).include('#solution-heading').analyze()).violations,
    ).toEqual([]);

    const sql = e2eSql();
    const audit =
      await sql`SELECT action FROM mod_actions m JOIN solutions s ON s.id::text = m.target_id
      WHERE s.body = ${answer}`;
    await sql.end();
    expect(audit.map((a) => a.action)).toEqual(['solution.approve']);
    await otherCtx.close();
    await modCtx.close();
  });

  test('requires a public https source', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/tradle');
    await page.getByRole('button', { name: 'Share the answer' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Answer').fill('Chile');
    await dialog.getByLabel("Where it's published").fill('http://localhost/answers');
    await dialog.getByRole('button', { name: 'Send for review' }).click();
    await expect(dialog.getByRole('alert')).toContainText('public https page');
  });

  test('refuses live puzzles, old puzzles and duplicates', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/tradle');
    const today = await todayNumber('tradle');
    const send = (puzzleNumber: number) =>
      apiPost(page, '/api/solutions', {
        slug: 'tradle',
        puzzleNumber,
        body: 'Peru',
        sourceUrl: 'https://example.org/peru',
      });
    expect((await send(today)).status()).toBe(422);
    expect((await send(today - 8)).status()).toBe(422);
    expect((await send(today - 2)).status()).toBe(200);
    const dup = await send(today - 2);
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error.code).toBe('duplicate');
  });

  test('only moderators can decide', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/tradle');
    const res = await apiPost(page, '/api/admin/solutions/00000000-0000-4000-8000-000000000000', {
      decision: 'approve',
    });
    expect(res.status()).toBe(403);
  });
});
