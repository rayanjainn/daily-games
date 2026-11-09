import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { e2eSql } from './support/db';
import { expect, test } from './support/fixtures';
import { follow, played } from './support/play';
import { signInAs } from './support/session';
import { settle } from './support/shots';

/**
 * High-resolution captures of the real app for the launch video (scripts/promo). Fictional
 * players only. Runs only with PROMO_DIR set.
 */
const OUT = process.env.PROMO_DIR;
test.skip(!OUT, 'set PROMO_DIR to capture launch-video screens');

const FRIENDS = ['Maya', 'Theo', 'Priya', 'Sam'];

async function player(
  browser: Browser,
  name: string,
  dpr: number,
  viewport: { width: number; height: number },
) {
  const ctx = await browser.newContext({
    deviceScaleFactor: dpr,
    viewport,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const user = await signInAs(page);
  const sql = e2eSql();
  await sql`UPDATE users SET display_name = ${name} WHERE id = ${user.id}`;
  await sql.end();
  return { ctx, page, user };
}

async function befriend(a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  const sql = e2eSql();
  await sql`INSERT INTO friendships (user_a, user_b, status, requested_by, accepted_at)
    VALUES (${x}, ${y}, 'accepted', ${a}, now()) ON CONFLICT DO NOTHING`;
  await sql.end();
}

async function shot(page: Page, file: string, fullPage = false) {
  await settle(page);
  await page.screenshot({ path: join(OUT!, file), fullPage });
}

for (const [label, dpr, viewport] of [
  ['desktop', 2, { width: 1440, height: 900 }],
  ['phone', 3, { width: 390, height: 844 }],
] as const) {
  test(`launch video screens (${label})`, async ({ browser }) => {
    test.setTimeout(180_000);
    mkdirSync(OUT!, { recursive: true });
    const me = await player(browser, 'Robin', dpr, viewport);
    const games = ['wordle', 'connections', 'strands', 'glow', 'sixes', 'contexto'];
    await follow(me.page, games);
    await played(me.user.id, 'wordle', [1, 2, 3, 4, 5, 6, 7, 8, 9], {
      attempts: 3,
      maxAttempts: 6,
    });
    await played(me.user.id, 'wordle', [0], { attempts: 4, maxAttempts: 6 });
    await played(me.user.id, 'connections', [0, 1, 2, 3, 4, 5], { attempts: 4, maxAttempts: 4 });
    await played(me.user.id, 'strands', [1, 2, 3, 4], {});
    await played(me.user.id, 'glow', [0, 1, 2], { attempts: 7, maxAttempts: 30, source: 'native' });

    for (const [i, name] of FRIENDS.entries()) {
      const f = await player(browser, name, 1, { width: 800, height: 600 });
      await befriend(me.user.id, f.user.id);
      await played(f.user.id, 'wordle', [0, 1, 2], { attempts: 3 + (i % 3), maxAttempts: 6 });
      await played(f.user.id, 'glow', [0], { attempts: 7 + i, maxAttempts: 30, source: 'native' });
      await f.ctx.close();
    }
    const sql = e2eSql();
    await sql`
      INSERT INTO official_answers (id, game_id, puzzle_date, answer, source_url)
      SELECT gen_random_uuid(), g.id, (now() AT TIME ZONE 'UTC')::date,
        ${sql.json({ kind: 'word', word: 'CRANE' })}, 'https://www.nytimes.com/games/wordle/index.html'
      FROM games g WHERE g.slug = 'wordle'
      ON CONFLICT (game_id, puzzle_date) DO UPDATE SET answer = EXCLUDED.answer`;
    await sql.end();

    const p = me.page;
    await p.goto('/today');
    await expect(p.getByRole('heading', { name: 'Hi, Robin' })).toBeVisible();
    await shot(p, `${label}-today.png`);
    await shot(p, `${label}-today-full.png`, true);
    await p.goto('/games');
    await shot(p, `${label}-games.png`);
    await p.goto('/games/wordle');
    await p.getByRole('button', { name: "Reveal today's answer" }).click();
    await expect(p.getByRole('img', { name: 'CRANE' })).toBeVisible();
    await p.getByRole('region', { name: "Today's answer" }).scrollIntoViewIfNeeded();
    await shot(p, `${label}-answer.png`);
    await p.goto('/games/sixes/play');
    await shot(p, `${label}-sixes.png`);
    await p.goto('/rankings?scope=all');
    await shot(p, `${label}-rankings.png`);
    await p.goto('/friends');
    await shot(p, `${label}-friends.png`);
    await me.ctx.close();
  });
}
