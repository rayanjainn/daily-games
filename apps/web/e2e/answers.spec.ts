import AxeBuilder from '@axe-core/playwright';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { follow, played } from './support/play';
import { signInAs } from './support/session';

/** Stores an answer as if it had been fetched from the publisher, so tests never call out. */
async function seedAnswer(slug: string, answer: unknown) {
  const sql = e2eSql();
  await sql`
    INSERT INTO official_answers (id, game_id, puzzle_date, answer, source_url)
    SELECT gen_random_uuid(), g.id, (now() AT TIME ZONE 'UTC')::date, ${sql.json(answer as never)},
      'https://www.nytimes.com/games/' || g.slug
    FROM games g WHERE g.slug = ${slug}
    ON CONFLICT (game_id, puzzle_date) DO UPDATE SET answer = EXCLUDED.answer`;
  const [r] = await sql`SELECT (now() AT TIME ZONE 'UTC')::date::text AS d`;
  await sql.end();
  return r!.d as string;
}

test.describe('official answers', () => {
  test('stay locked until the puzzle is logged, then reveal with the source', async ({ page }) => {
    const me = await signInAs(page);
    await follow(page, ['wordle']);
    const date = await seedAnswer('wordle', { kind: 'word', word: 'CRANE' });

    await page.goto('/games/wordle');
    const section = page.getByRole('region', { name: "Today's answer" });
    await expect(section.getByTestId('answer-locked')).toContainText('nytimes.com');
    await expect(section.getByRole('button', { name: "Reveal today's answer" })).toHaveCount(0);
    // The API refuses too, so the answer can't be pulled before playing.
    const early = await page.request.get(`/api/games/wordle/answer?date=${date}`);
    expect(early.status()).toBe(403);
    expect((await early.json()).error.code).toBe('play_first');

    await played(me.id, 'wordle', [0], { attempts: 6, maxAttempts: 6, solved: false });
    await page.reload();
    await section.getByRole('button', { name: "Reveal today's answer" }).click();
    await expect(section.getByRole('img', { name: 'CRANE' })).toBeVisible();
    await expect(section.getByRole('link', { name: /Answer from nytimes.com/ })).toHaveAttribute(
      'href',
      /nytimes\.com/,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('shows grouped answers in order', async ({ page }) => {
    const me = await signInAs(page);
    await seedAnswer('connections', {
      kind: 'groups',
      groups: [
        { title: 'SHADES OF BLUE', items: ['NAVY', 'TEAL', 'SKY', 'COBALT'] },
        { title: 'CARD GAMES', items: ['SNAP', 'RUMMY', 'POKER', 'BRIDGE'] },
      ],
    });
    await played(me.id, 'connections', [0], { attempts: 4, maxAttempts: 4 });
    await page.goto('/games/connections');
    await page.getByRole('button', { name: "Reveal today's answer" }).click();
    const answer = page.getByTestId('answer');
    await expect(answer.getByRole('listitem')).toHaveCount(2);
    await expect(answer.getByRole('listitem').first()).toContainText('SHADES OF BLUE');
    await expect(answer).toContainText('NAVY, TEAL, SKY, COBALT');
  });

  test('games whose publisher has no answers show nothing and refuse the API', async ({ page }) => {
    await signInAs(page);
    await page.goto('/games/flagle');
    await expect(page.getByRole('region', { name: "Today's answer" })).toHaveCount(0);
    const res = await page.request.get('/api/games/flagle/answer?date=2026-01-01');
    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('no_source');
    const bad = await page.request.get('/api/games/wordle/answer?date=yesterday');
    expect(bad.status()).toBe(400);
  });
});
