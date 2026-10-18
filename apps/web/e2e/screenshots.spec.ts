import type { Page } from '@playwright/test';
import { apiPost, fillConfirmation, signUpViaUi, solveGateInUi } from './support/auth';
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

/**
 * One answer for yesterday's puzzle from a fixed player, so parallel captures share it instead of
 * stacking copies.
 */
async function seedAnswer(slug: string, body: string, status: string) {
  const sql = e2eSql();
  const author = status === 'approved' ? 'shots_author' : 'shots_pending';
  await sql`INSERT INTO users (id, username, timezone) VALUES (gen_random_uuid(), ${author}, 'UTC')
    ON CONFLICT DO NOTHING`;
  const [a] = await sql`SELECT id FROM users WHERE username = ${author}`;
  await sql`INSERT INTO solutions (id, game_id, puzzle_number, puzzle_date, author_id, body,
      source_url, status, decided_at)
    SELECT gen_random_uuid(), g.id,
      g.epoch_number + ((now() AT TIME ZONE 'UTC')::date - 1 - g.puzzle_epoch),
      (now() AT TIME ZONE 'UTC')::date - 1, ${a!.id}, ${body},
      'https://example.org/tradle/answers', ${status}, now()
    FROM games g WHERE g.slug = ${slug} ON CONFLICT DO NOTHING`;
  await sql.end();
}
const approvedAnswer = (_viewer: string, slug: string, body: string) =>
  seedAnswer(slug, body, 'approved');
const pendingAnswer = (_viewer: string, slug: string, body: string) =>
  seedAnswer(slug, body, 'pending');

/** Creates named players (once) and links them to `u` with the given relationship. */
async function befriend(
  u: { id: string },
  names: string[],
  kind: 'accepted' | 'incoming' | 'outgoing',
): Promise<string[]> {
  const sql = e2eSql();
  const ids: string[] = [];
  for (const name of names) {
    await sql`INSERT INTO users (id, username, timezone) VALUES (gen_random_uuid(), ${name}, 'UTC')
      ON CONFLICT DO NOTHING`;
    const [o] = await sql`SELECT id FROM users WHERE username = ${name}`;
    const other = o!.id as string;
    const [a, b] = u.id < other ? [u.id, other] : [other, u.id];
    await sql`INSERT INTO friendships (user_a, user_b, status, requested_by, accepted_at)
      VALUES (${a}, ${b}, ${kind === 'accepted' ? 'accepted' : 'pending'},
        ${kind === 'outgoing' ? u.id : other}, ${kind === 'accepted' ? new Date() : null})
      ON CONFLICT DO NOTHING`;
    ids.push(other);
  }
  await sql.end();
  return ids;
}

/**
 * A group owned by `ownerId` with named players who played Wordle today and earlier this week.
 * The named players are shared by every capture, so their history is reset first.
 */
async function seedGroup(ownerId: string, name: string, members: string[]): Promise<string> {
  const sql = e2eSql();
  const [g] = await sql`INSERT INTO groups (id, name, invite_code, owner_id)
    VALUES (gen_random_uuid(), ${name}, ${`shots${ownerId.slice(0, 8)}${name.length}`}, ${ownerId})
    RETURNING id`;
  const groupId = g!.id as string;
  await sql`INSERT INTO group_members (group_id, user_id, role) VALUES (${groupId}, ${ownerId}, 'owner')`;
  const ids: string[] = [];
  for (const m of members) {
    await sql`INSERT INTO users (id, username, timezone) VALUES (gen_random_uuid(), ${m}, 'UTC')
      ON CONFLICT DO NOTHING`;
    const [u] = await sql`SELECT id FROM users WHERE username = ${m}`;
    await sql`INSERT INTO group_members (group_id, user_id) VALUES (${groupId}, ${u!.id})`;
    await sql`DELETE FROM results WHERE user_id = ${u!.id}`;
    ids.push(u!.id as string);
  }
  await sql.end();
  const today = [3, 5, 0, 4];
  for (const [i, id] of ids.entries()) {
    const a = today[i % today.length]!;
    await played(
      id,
      'wordle',
      [0],
      a ? { attempts: a, maxAttempts: 6 } : { solved: false, maxAttempts: 6 },
    );
    await played(id, 'wordle', [1, 2, 3].slice(0, i + 1), { attempts: 4, maxAttempts: 6 });
  }
  return groupId;
}

/**
 * A Wordle board with flairs, a few posts and a short threaded discussion, written with fixed
 * ids so every capture shares the same content.
 */
async function seedCommunity(slug: string): Promise<{ postId: string }> {
  const sql = e2eSql();
  const players: string[] = [];
  for (const name of ['ava_plays', 'ben_words', 'cai_maps']) {
    await sql`INSERT INTO users (id, username, timezone) VALUES (gen_random_uuid(), ${name}, 'UTC')
      ON CONFLICT DO NOTHING`;
    const [u] = await sql`SELECT id FROM users WHERE username = ${name}`;
    players.push(u!.id as string);
  }
  const [g] = await sql`SELECT id, name FROM games WHERE slug = ${slug}`;
  await sql`INSERT INTO communities (id, slug, name, description, game_id)
    VALUES (gen_random_uuid(), ${slug}, ${g!.name},
      ${`Talk about ${g!.name}: strategies, streaks and the daily thread.`}, ${g!.id})
    ON CONFLICT DO NOTHING`;
  const [c] = await sql`SELECT id FROM communities WHERE slug = ${slug}`;
  const flair = (n: number) => `01900000-0000-7000-8000-00000000000${n}`;
  await sql`INSERT INTO flairs (id, community_id, name, color) VALUES
    (${flair(1)}, ${c!.id}, 'Strategy', 'grape'), (${flair(2)}, ${c!.id}, 'Streaks', 'mint'),
    (${flair(3)}, ${c!.id}, 'Question', 'sky') ON CONFLICT DO NOTHING`;
  const post = (n: number) => `01900000-0000-7000-8000-0000000000${10 + n}`;
  const rows: [number, string, string, string | null, number, number][] = [
    [
      1,
      'Which starting word do you swear by?',
      'I have used **CRANE** for a year. Thinking of switching to something with an S.',
      flair(1),
      14,
      0,
    ],
    [
      2,
      '200-day streak today!',
      'Never thought I would get here. The trick was a reminder at 8am.',
      flair(2),
      31,
      1,
    ],
    [
      3,
      'Do hard-mode results count differently?',
      'Is there any way to mark hard mode when logging?',
      flair(3),
      4,
      2,
    ],
  ];
  for (const [n, title, body, f, score, author] of rows) {
    await sql`INSERT INTO posts (id, community_id, author_id, title, body_md, flair_id, score, comment_count, created_at)
      VALUES (${post(n)}, ${c!.id}, ${players[author]!}, ${title}, ${body}, ${f}, ${score}, ${n === 1 ? 3 : 0},
        now() - ${`${n * 3} hours`}::interval) ON CONFLICT DO NOTHING`;
  }
  const cm = (n: number) => `01900000-0000-7000-8000-0000000001${10 + n}`;
  const comments: [number, string, number, string][] = [
    [1, cm(1), 1, 'SLATE has been great for me: three common consonants and an A.'],
    [2, `${cm(1)}/${cm(2)}`, 0, 'I tried SLATE for a month and my average went from 4.1 to 3.8!'],
    [3, cm(3), 2, 'ADIEU gets the vowels out of the way, but I find it slower overall.'],
  ];
  for (const [n, path, author, body] of comments) {
    await sql`INSERT INTO comments (id, post_id, parent_id, author_id, body_md, depth, path, score)
      VALUES (${cm(n)}, ${post(1)}, ${n === 2 ? cm(1) : null}, ${players[author]!}, ${body},
        ${path.split('/').length - 1}, ${path}, ${5 - n}) ON CONFLICT DO NOTHING`;
  }
  await sql.end();
  return { postId: post(1) };
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

async function cardsWeek(page: Page) {
  const u = await signInAs(page);
  await follow(page, ['wordle', 'connections', 'tradle']);
  await wordleHistory(u.id);
  await played(u.id, 'connections', [0, 2, 3], { attempts: 4, maxAttempts: 4 });
  await played(u.id, 'tradle', [1, 6], { source: 'checkbox' });
}

const SETS: Record<string, Screen[]> = {
  'daily-score': [
    {
      name: 'today-freeze',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'globle', 'nyt-mini']);
        await played(u.id, 'globle', [1, 2, 3, 4, 5, 6, 7]);
        await played(u.id, 'wordle', [0, 1], { attempts: 3, maxAttempts: 6 });
        await played(u.id, 'nyt-mini', [0], { timeSeconds: 64 });
        await page.goto('/today');
        await expect(page.getByTestId('freezes')).toBeVisible();
      },
    },
    {
      name: 'today-freeze-used',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'globle']);
        await played(u.id, 'globle', [2, 3, 4, 5, 6, 7, 8]);
        await page.goto('/today');
        await expect(page.getByTestId('freeze-used')).toBeVisible();
      },
    },
  ],
  gaps: [
    {
      name: 'badges-new',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle']);
        await page.goto('/today');
        await expect(page.getByTestId('today-headline')).toBeVisible();
        await wordleHistory(u.id);
        await page.goto('/badges');
        await expect(page.locator('[data-new]').first()).toBeVisible();
      },
    },
    {
      name: 'board-moderation',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page, { role: 'mod' });
        const { postId } = await seedCommunity('wordle');
        const sql = e2eSql();
        const [ava] = await sql`SELECT id FROM users WHERE username = 'ava_plays'`;
        const [ben] = await sql`SELECT id FROM users WHERE username = 'ben_words'`;
        const [c] = await sql`SELECT id FROM communities WHERE slug = 'wordle'`;
        await sql`DELETE FROM content_reports WHERE target_id = ${postId}`;
        await sql`INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason)
          VALUES (gen_random_uuid(), ${ben!.id}, 'post', ${postId}, 'Advertising a different word game')`;
        await sql`DELETE FROM community_moderators WHERE community_id = ${c!.id}`;
        await sql`INSERT INTO community_moderators (community_id, user_id, added_by)
          VALUES (${c!.id}, ${ava!.id}, ${u.id})`;
        await sql.end();
        await page.goto('/c/wordle/mod');
        await expect(page.getByTestId('board-reports')).toBeVisible();
      },
    },
    {
      name: 'inline-spoiler',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/c/everydaily');
        const { id } = await (
          await apiPost(page, '/api/c/everydaily/posts', {
            title: 'Yesterday was a tricky one',
            body: 'I got it in 5. The answer was ||MONGOLIA||, and the clue about ||copper exports|| gave it away.',
          })
        ).json();
        await apiPost(page, `/api/posts/${id}/comments`, {
          body: 'Same here: the first letter was ||M||.',
          parentId: null,
        });
        await page.goto(`/c/everydaily/${id}`);
        await expect(page.locator('.spoiler').first()).toBeVisible();
        // Reveal one, so the capture shows both states.
        await page.locator('.spoiler').first().click();
      },
    },
    {
      name: 'recap-dark-card',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections', 'tradle']);
        await wordleHistory(u.id);
        await played(u.id, 'connections', [0, 2, 3, 6, 9], { attempts: 4, maxAttempts: 4 });
        await page.goto('/recap');
        await page.getByRole('button', { name: 'Dark card' }).click();
        const img = page.getByTestId('share-image');
        await expect(img).toHaveAttribute('src', /theme=dark/);
        await expect
          .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
          .toBe(1080);
      },
    },
  ],
  picks: [
    {
      name: 'today-picks',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections']);
        await befriend(u, ['ava_plays', 'ben_words'], 'accepted');
        const sql = e2eSql();
        await sql`INSERT INTO follows (user_id, game_id, position)
          SELECT u.id, g.id, 0 FROM users u, games g
          WHERE u.username IN ('ava_plays', 'ben_words') AND g.slug = 'murdle'
          ON CONFLICT DO NOTHING`;
        await sql.end();
        await page.goto('/today');
        await expect(page.getByTestId('picks')).toBeVisible();
      },
    },
  ],
  badges: [
    {
      name: 'badges',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections']);
        await wordleHistory(u.id);
        await played(u.id, 'connections', [0, 1, 2, 3], { attempts: 4, maxAttempts: 4 });
        await played(u.id, 'tradle', [30, 31], { source: 'checkbox', fromArchive: true });
        await page.goto('/badges');
        await expect(page.getByTestId('badges')).toBeVisible();
      },
    },
    {
      name: 'today-links',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections']);
        await played(u.id, 'wordle', [0, 1, 2], { attempts: 4, maxAttempts: 6 });
        await page.goto('/today');
        await expect(page.getByRole('link', { name: /Badges/ })).toBeVisible();
      },
    },
  ],
  'month-recap': [
    {
      name: 'recap-month',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections', 'tradle']);
        await wordleHistory(u.id);
        await played(u.id, 'connections', [0, 2, 3, 6, 9], { attempts: 4, maxAttempts: 4 });
        await played(u.id, 'tradle', [1, 6], { source: 'checkbox' });
        await page.goto('/recap');
        await page.getByRole('link', { name: 'This month' }).click();
        const img = page.getByTestId('share-image');
        await expect(img).toHaveAttribute('src', /month=/);
        await expect
          .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
          .toBe(1080);
      },
    },
  ],
  cards: [
    {
      name: 'recap',
      path: '/',
      setup: async (page) => {
        await cardsWeek(page);
        await page.goto('/recap');
        const img = page.getByTestId('share-image');
        await expect
          .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
          .toBe(1080);
      },
    },
    {
      name: 'stat-card-dialog',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await cardsWeek(page);
        await page.goto('/games/wordle');
        await page.getByRole('button', { name: 'Stat card' }).click();
        const img = page.getByTestId('share-image');
        await expect
          .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
          .toBe(1200);
      },
    },
  ],
  realtime: [
    {
      name: 'realtime-thread',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        const { postId } = await seedCommunity('wordle');
        await page.goto(`/c/wordle/${postId}`);
        // A second reader, typing.
        const other = await page.context().browser()!.newContext();
        // Leave the room when this capture ends, so the next one starts with two readers.
        page.once('close', () => void other.close());
        const p2 = await other.newPage();
        await signInAs(p2);
        await p2.goto(`/c/wordle/${postId}`);
        await expect(page.getByTestId('live-bar')).toContainText('2 here');
        await p2.getByLabel('Add a comment').pressSequentially('I think');
        await expect(page.getByTestId('live-bar')).toContainText('is typing');
        await page.getByRole('heading', { name: /Comments/ }).scrollIntoViewIfNeeded();
      },
    },
  ],
  community: [
    {
      name: 'community-index',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await follow(page, ['wordle', 'connections', 'strands', 'globle']);
        await page.goto('/c');
        await expect(page.getByTestId('followed-communities')).toBeVisible();
      },
    },
    {
      name: 'community-feed',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        await seedCommunity('wordle');
        await page.goto('/c/wordle');
        await expect(page.getByTestId('posts')).toBeVisible();
      },
    },
    {
      name: 'community-post',
      path: '/',
      setup: async (page) => {
        await signInAs(page);
        const { postId } = await seedCommunity('wordle');
        await page.goto(`/c/wordle/${postId}`);
        await expect(page.getByTestId('comments')).toBeVisible();
      },
    },
    {
      name: 'community-daily-hidden',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/c/wordle');
        const sql = e2eSql();
        const [d] = await sql`SELECT p.id FROM posts p JOIN communities c ON c.id = p.community_id
          WHERE c.slug = 'wordle' AND p.is_daily_thread ORDER BY p.puzzle_number DESC LIMIT 1`;
        const [a] = await sql`SELECT id FROM users WHERE username = 'ava_plays'`;
        if (a) {
          await sql`INSERT INTO comments (id, post_id, author_id, body_md, depth, path)
            VALUES (${'01900000-0000-7000-8000-000000000101'}, ${d!.id}, ${a.id},
              'Two yellows on the first guess, then it fell into place.', 0,
              ${'01900000-0000-7000-8000-000000000101'}) ON CONFLICT DO NOTHING`;
          await sql`UPDATE posts SET comment_count = (SELECT count(*) FROM comments WHERE post_id = ${d!.id})
            WHERE id = ${d!.id}`;
        }
        await sql.end();
        await page.goto(`/c/wordle/${d!.id}`);
        await expect(page.getByTestId('comments-hidden')).toBeVisible();
      },
    },
  ],
  groups: [
    {
      name: 'groups-list',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await seedGroup(u.id, 'Family puzzlers', ['ava_plays', 'ben_words', 'cai_maps']);
        await seedGroup(u.id, 'Office league', ['dee_logic']);
        await page.goto('/groups');
        await expect(page.getByTestId('groups')).toBeVisible();
      },
    },
    {
      name: 'groups-board-hidden',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        const id = await seedGroup(u.id, 'Family puzzlers', ['ava_plays', 'ben_words', 'cai_maps']);
        await page.goto(`/groups/${id}?game=wordle`);
        await expect(page.getByTestId('today-board')).toBeVisible();
      },
    },
    {
      name: 'groups-board',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        const id = await seedGroup(u.id, 'Family puzzlers', ['ava_plays', 'ben_words', 'cai_maps']);
        await played(u.id, 'wordle', [0], { attempts: 4, maxAttempts: 6 });
        await page.goto(`/groups/${id}?game=wordle`);
        await expect(page.getByTestId('today-board')).toContainText('4/6');
      },
    },
  ],
  friends: [
    {
      name: 'friends-list',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await befriend(u, ['ava_plays', 'ben_words'], 'accepted');
        await befriend(u, ['cai_maps'], 'incoming');
        await befriend(u, ['dee_logic'], 'outgoing');
        await page.goto('/friends');
        await expect(page.getByTestId('friends')).toBeVisible();
      },
    },
    {
      name: 'friends-h2h',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        const [ava] = await befriend(u, ['ava_plays'], 'accepted');
        // ava_plays is shared by every capture; start from a clean history each time.
        const sql = e2eSql();
        await sql`DELETE FROM results WHERE user_id = ${ava!}`;
        await sql.end();
        for (const [slug, mine, theirs] of [
          ['wordle', [3, 4, 5, 2, 4], [4, 4, 3, 5, 6]],
          ['connections', [4, 4, 4], [4, 4, 4]],
        ] as const) {
          for (const [i, a] of mine.entries())
            await played(u.id, slug, [i + 1], { attempts: a, maxAttempts: 6 });
          for (const [i, a] of theirs.entries())
            await played(ava!, slug, [i + 1], { attempts: a, maxAttempts: 6 });
        }
        await played(ava!, 'wordle', [0], { attempts: 3, maxAttempts: 6 });
        await page.goto('/friends/ava_plays');
        await expect(page.getByTestId('h2h-games')).toBeVisible();
      },
    },
  ],
  'friends-board': [
    {
      name: 'friends-board',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        const ids = await befriend(u, ['ava_plays', 'ben_words', 'cai_maps'], 'accepted');
        const sql = e2eSql();
        await sql`DELETE FROM results WHERE user_id IN ${sql(ids)}`;
        await sql.end();
        const scores: [string, number[]][] = [
          [u.id, [4, 3, 5, 4]],
          [ids[0]!, [3, 4, 4, 0]],
          [ids[1]!, [5, 2, 0, 3]],
        ];
        for (const [id, list] of scores)
          for (const [i, a] of list.entries())
            await played(
              id,
              'wordle',
              [i],
              a === 0 ? { solved: false, maxAttempts: 6 } : { attempts: a, maxAttempts: 6 },
            );
        await played(u.id, 'connections', [0, 1], { attempts: 4, maxAttempts: 4 });
        await page.goto('/friends?game=wordle');
        await expect(page.getByTestId('today-board')).toBeVisible();
      },
    },
  ],
  polish: [
    {
      name: 'polish-games',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games');
        await expect(page.getByTestId('game-card').first()).toBeVisible();
      },
    },
    {
      name: 'polish-today',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections', 'strands', 'globle', 'tradle']);
        await played(u.id, 'wordle', [0, 1], { attempts: 3, maxAttempts: 6 });
        await played(u.id, 'connections', [0], { attempts: 4, maxAttempts: 4 });
        await played(u.id, 'globle', [0], { attempts: 5 });
        await page.goto('/today');
        await expect(page.getByRole('progressbar').locator('[data-segment]')).toHaveCount(3);
      },
    },
  ],
  email: [
    {
      name: 'email-unconfirmed',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/settings');
        const section = page.getByRole('region', { name: 'Email' });
        await section.getByLabel('Email address').fill(`ava_${Date.now()}@example.org`);
        await section.getByRole('button', { name: 'Send confirmation link' }).click();
        await expect(section.getByTestId('email-status')).toBeVisible();
        await section.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      },
    },
    {
      name: 'email-confirmed',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        const u = await signInAs(page);
        const sql = e2eSql();
        await sql`UPDATE users SET email = ${`cai_${u.id.slice(0, 8)}@example.org`},
          email_verified_at = now(), email_reminders = true WHERE id = ${u.id}`;
        await sql.end();
        await page.goto('/settings');
        await page
          .getByRole('region', { name: 'Reminders' })
          .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      },
    },
    {
      name: 'email-verify-page',
      path: '/verify-email?token=not-a-real-token-but-long-enough',
      viewportOnly: true,
    },
  ],
  reminders: [
    {
      name: 'reminders-off',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await follow(page, ['wordle', 'connections', 'strands']);
        await page
          .context()
          .grantPermissions(['notifications'], { origin: new URL(page.url()).origin });
        await page.goto('/settings');
        await expect(page.getByTestId('push-state')).toHaveText('Off for this device');
        await page
          .getByRole('region', { name: 'Reminders' })
          .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      },
    },
    {
      name: 'reminders-configured',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections', 'strands']);
        const sql = e2eSql();
        await sql`UPDATE users SET streak_nudge_at = '20:30', quiet_hours_start = '22:00',
          quiet_hours_end = '07:30' WHERE id = ${u.id}`;
        await sql`UPDATE follows SET remind_at = '08:00' WHERE user_id = ${u.id}
          AND game_id = (SELECT id FROM games WHERE slug = 'wordle')`;
        await sql`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, label)
          VALUES (gen_random_uuid(), ${u.id}, ${`https://push.example.com/${u.id}`}, 'k', 'a',
          'Chrome on Android')`;
        await sql.end();
        await page
          .context()
          .grantPermissions(['notifications'], { origin: new URL(page.url()).origin });
        await page.goto('/settings');
        await expect(page.getByTestId('push-state')).toHaveText('Off for this device');
        await page
          .getByRole('region', { name: 'Reminders' })
          .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      },
    },
  ],
  solutions: [
    {
      name: 'solution-hidden',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        const u = await signInAs(page);
        await approvedAnswer(u.id, 'tradle', 'Mongolia. The big clue was copper exports to China.');
        await page.goto('/games/tradle');
        await page.getByRole('heading', { name: "Yesterday's answer" }).scrollIntoViewIfNeeded();
      },
    },
    {
      name: 'solution-revealed',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        const u = await signInAs(page);
        await approvedAnswer(u.id, 'tradle', 'Mongolia. The big clue was copper exports to China.');
        await page.goto('/games/tradle');
        await page.getByText('Reveal the answer').click();
        await page.getByRole('heading', { name: "Yesterday's answer" }).scrollIntoViewIfNeeded();
      },
    },
    {
      name: 'solution-share',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/tradle');
        await page.getByRole('button', { name: 'Share the answer' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Answer').fill('Mongolia');
        await dialog.getByLabel("Where it's published").fill('http://localhost');
        await dialog.getByRole('button', { name: 'Send for review' }).click();
        await expect(dialog.getByRole('alert')).toBeVisible();
      },
    },
    {
      name: 'solution-pending',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/tradle');
        await page.getByRole('button', { name: 'Share the answer' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Answer').fill('Mongolia');
        await dialog.getByLabel("Where it's published").fill('https://example.org/tradle');
        await dialog.getByRole('button', { name: 'Send for review' }).click();
        await expect(page.getByTestId('solution-mine')).toBeVisible();
        await page.getByRole('heading', { name: "Yesterday's answer" }).scrollIntoViewIfNeeded();
      },
    },
    {
      name: 'solution-mod-queue',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page, { role: 'mod' });
        await pendingAnswer(u.id, 'tradle', 'Mongolia (copper and coal exports).');
        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: /Answers/ })).toBeVisible();
      },
    },
  ],
  notes: [
    {
      name: 'notes-empty',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/connections');
        await page.getByRole('heading', { name: 'Your notes' }).scrollIntoViewIfNeeded();
      },
    },
    {
      name: 'notes-saved',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games/connections');
        const field = page.getByLabel('Your notes for Connections');
        await field.fill(
          'Purple is usually wordplay: hidden words, prefixes, homophones.\nSolve yellow first, then look for the red herring across groups.',
        );
        await expect(page.getByTestId('note-status')).toHaveText('Saved');
        await page.getByRole('heading', { name: 'Your notes' }).scrollIntoViewIfNeeded();
      },
    },
  ],
  archive: [
    {
      name: 'archive-tracker',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle']);
        await played(u.id, 'wordle', [0, 1, 4, 5, 8, 9, 10, 12, 13], {
          attempts: 4,
          maxAttempts: 6,
        });
        await played(u.id, 'wordle', [6], { attempts: 3, maxAttempts: 6, fromArchive: true });
        await page.goto('/games/wordle');
        await page.getByRole('heading', { name: 'Catch up' }).scrollIntoViewIfNeeded();
      },
    },
    {
      name: 'archive-dialog',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        const u = await signInAs(page);
        await played(u.id, 'wordle', [0, 2], { attempts: 4, maxAttempts: 6 });
        await page.goto('/games/wordle');
        await page.getByRole('button', { name: /^Log #/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      },
    },
    {
      name: 'archive-caught-up',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        const u = await signInAs(page);
        await played(u.id, 'tradle', [1, 3], { source: 'checkbox' });
        await page.goto('/games/tradle');
        await page.getByRole('button', { name: /^Log / }).click();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: /^Mark .* done$/ })
          .click();
        await expect(page.getByTestId('log-success')).toBeVisible();
      },
    },
  ],
  theme: [
    { name: 'theme-styleguide', path: '/styleguide' },
    {
      name: 'theme-today',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await follow(page, ['wordle', 'connections', 'strands', 'nyt-mini', 'flagle']);
        await played(u.id, 'wordle', [0, 1, 2, 3, 4], { attempts: 4, maxAttempts: 6 });
        await played(u.id, 'flagle', [1, 2], { source: 'checkbox' });
        await page.goto('/today');
        await expect(page.getByTestId('checklist-item')).toHaveCount(5);
      },
    },
    {
      name: 'theme-games',
      path: '/',
      viewportOnly: true,
      setup: async (page) => {
        await signInAs(page);
        await page.goto('/games');
        await expect(page.getByTestId('game-card').first()).toBeVisible();
      },
    },
    {
      name: 'theme-game-stats',
      path: '/',
      setup: async (page) => {
        const u = await signInAs(page);
        await wordleHistory(u.id);
        await page.goto('/games/wordle');
        await expect(page.getByTestId('distribution')).toBeVisible();
      },
    },
  ],
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
