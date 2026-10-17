import AxeBuilder from '@axe-core/playwright';
import { apiSend } from './support/auth';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { signInAs } from './support/session';

async function noteFor(userId: string, slug: string) {
  const sql = e2eSql();
  const rows = await sql`SELECT n.body FROM game_notes n JOIN games g ON g.id = n.game_id
    WHERE n.user_id = ${userId} AND g.slug = ${slug}`;
  await sql.end();
  return rows[0]?.body ?? null;
}

test.describe('game notes', () => {
  test('saves as you type and survives a reload', async ({ page }) => {
    const user = await signInAs(page);
    await page.goto('/games/wordle');
    const notes = page.getByRole('region', { name: 'Your notes' });
    const field = notes.getByLabel('Your notes for Wordle');
    await field.fill('Start with CRANE.\nAvoid repeating letters early.');
    await expect(notes.getByTestId('note-status')).toHaveText('Saved');
    await expect.poll(() => noteFor(user.id, 'wordle')).toContain('Start with CRANE.');

    await page.reload();
    await expect(field).toHaveValue('Start with CRANE.\nAvoid repeating letters early.');

    await field.fill('');
    await field.blur();
    await expect(notes.getByTestId('note-status')).toHaveText('Saved');
    await expect.poll(() => noteFor(user.id, 'wordle')).toBeNull();
    expect((await new AxeBuilder({ page }).include('#notes-heading').analyze()).violations).toEqual(
      [],
    );
  });

  test('notes are private to each player', async ({ page, browser }) => {
    await signInAs(page);
    await page.goto('/games/connections');
    await page.getByLabel('Your notes for Connections').fill('Purple is usually wordplay.');
    await expect(page.getByTestId('note-status')).toHaveText('Saved');

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signInAs(otherPage);
    await otherPage.goto('/games/connections');
    await expect(otherPage.getByLabel('Your notes for Connections')).toHaveValue('');
    await other.close();
  });

  test('rejects notes over the limit and unknown games', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/wordle');
    const sql = e2eSql();
    const [g] = await sql`SELECT id FROM games WHERE slug = 'wordle'`;
    await sql.end();
    const long = await apiSend(page, 'PATCH', `/api/notes/${g!.id}`, { body: 'x'.repeat(4001) });
    expect(long.status()).toBe(400);
    const missing = await apiSend(
      page,
      'PATCH',
      '/api/notes/00000000-0000-4000-8000-000000000000',
      {
        body: 'hi',
      },
    );
    expect(missing.status()).toBe(404);
  });
});
