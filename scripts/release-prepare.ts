/**
 * Runs before the production build on Vercel: applies pending migrations and loads the game
 * catalog, so a release never reaches players ahead of its database changes.
 *
 * Fails closed: if anything here fails, the build fails and Vercel keeps serving the previous
 * deployment. Migrations must therefore be additive (the previous release keeps running while
 * this one builds); columns and tables are dropped only in a later release.
 *
 * Skipped outside production (preview builds must never touch the production database).
 * Usage: VERCEL_ENV=production DATABASE_URL=... pnpm release:prepare
 */
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createDb } from '@everydaily/shared/db';
import { loadGames } from '@everydaily/shared/registry/loader';
import { seedGames } from '@everydaily/shared/registry/seed';

if (process.env.VERCEL_ENV !== 'production' && process.env.RELEASE_PREPARE !== '1') {
  console.log(`release:prepare skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}).`);
  process.exit(0);
}

// Migrations want a direct connection; Neon's Vercel integration names it DATABASE_URL_UNPOOLED.
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DIRECT_DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;
if (!url) {
  console.error('release:prepare needs DATABASE_URL (or DATABASE_URL_UNPOOLED) at build time.');
  process.exit(1);
}

const started = Date.now();
const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL('../packages/shared/drizzle', import.meta.url)),
  });
  console.log('Migrations applied.');
} finally {
  await client.end();
}

const { db, client: seedClient } = createDb(url, { max: 1 });
try {
  const report = await seedGames(db, loadGames());
  console.log(
    `Games: ${report.inserted.length} inserted, ${report.updated.length} updated, ${report.unchanged.length} unchanged.`,
  );
} finally {
  await seedClient.end();
}
console.log(`release:prepare done in ${Date.now() - started} ms.`);
