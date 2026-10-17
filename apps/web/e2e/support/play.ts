import type { Page } from '@playwright/test';
import { apiPost } from './auth';
import { e2eSql } from './db';
import { expect } from './fixtures';

/** Follows games in order through the API (so positions are real). */
export async function follow(page: Page, slugs: string[]) {
  const sql = e2eSql();
  const rows = await sql`SELECT slug, id FROM games WHERE slug IN ${sql(slugs)}`;
  await sql.end();
  await page.goto('/games');
  for (const slug of slugs) {
    const id = rows.find((r) => r.slug === slug)!.id as string;
    expect((await apiPost(page, `/api/follows/${id}`, {})).status()).toBe(200);
  }
}

/**
 * Logs results `daysAgo` for a local-midnight game, for a player in UTC.
 * Puzzle number = epoch number + days since the epoch date.
 */
export async function played(
  userId: string,
  slug: string,
  daysAgo: number[],
  extra: {
    attempts?: number;
    maxAttempts?: number;
    solved?: boolean;
    source?: string;
    timeSeconds?: number;
    score?: number;
    fromArchive?: boolean;
  } = {},
) {
  const sql = e2eSql();
  for (const d of daysAgo) {
    await sql`
      INSERT INTO results (id, user_id, game_id, puzzle_number, puzzle_date, solved, attempts,
        max_attempts, source, time_seconds, score, from_archive)
      SELECT gen_random_uuid(), ${userId}, g.id,
        g.epoch_number + (((now() AT TIME ZONE 'UTC')::date - ${d}::int) - g.puzzle_epoch),
        (now() AT TIME ZONE 'UTC')::date - ${d}::int,
        ${extra.solved ?? true}, ${extra.attempts ?? null}, ${extra.maxAttempts ?? null},
        ${extra.source ?? 'paste'}, ${extra.timeSeconds ?? null}, ${extra.score ?? null},
        ${extra.fromArchive ?? false}
      FROM games g WHERE g.slug = ${slug}`;
  }
  await sql.end();
}
