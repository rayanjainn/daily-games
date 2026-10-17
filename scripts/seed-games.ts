/**
 * Loads packages/shared/games/*.yaml into the games table.
 * Usage: DATABASE_URL=... pnpm seed:games
 */
import { createDb } from '@everydaily/shared/db';
import { loadGames } from '@everydaily/shared/registry/loader';
import { seedGames } from '@everydaily/shared/registry/seed';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const { db, client } = createDb(url, { max: 1 });
try {
  const catalog = loadGames();
  const report = await seedGames(db, catalog);
  console.log(
    `Games: ${report.inserted.length} inserted, ${report.updated.length} updated, ${report.unchanged.length} unchanged.`,
  );
  if (report.overridden.length) {
    console.warn(`Moderator edits overridden by YAML changes: ${report.overridden.join(', ')}`);
  }
  if (report.dbOnly.length)
    console.log(`Games only in the database (left as is): ${report.dbOnly.join(', ')}`);
} finally {
  await client.end();
}
