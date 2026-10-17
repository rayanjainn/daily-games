/**
 * Integration-test database helpers. Requires TEST_DATABASE_URL (a disposable database).
 * Locally: scripts/local-services.sh start creates `everydaily_test`.
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { createDb } from '../db/client';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://everydaily@localhost:5432/everydaily_test';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Drops everything and re-applies migrations. Called once per test run (globalSetup). */
export async function resetTestDatabase() {
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(
      'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
    );
    await migrate(drizzle(client), { migrationsFolder });
  } catch (err) {
    throw new Error(
      `Could not prepare the test database at ${TEST_DATABASE_URL}. Start Postgres (scripts/local-services.sh start) or set TEST_DATABASE_URL.\n${String(err)}`,
    );
  } finally {
    await client.end();
  }
}

export function testDb() {
  return createDb(TEST_DATABASE_URL, { max: 2 });
}

/** Empties every application table (keeps migrations). */
export async function truncateAll(db: ReturnType<typeof testDb>['db']) {
  const rows = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const names = rows.map((r) => `"${r.tablename}"`).join(', ');
  if (names) await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}
