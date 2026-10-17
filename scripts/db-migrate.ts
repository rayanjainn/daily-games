/**
 * Applies pending migrations from packages/shared/drizzle.
 * Usage: DATABASE_URL=... pnpm tsx scripts/db-migrate.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const migrationsFolder = fileURLToPath(new URL('../packages/shared/drizzle', import.meta.url));
await migrate(drizzle(client), { migrationsFolder });
await client.end();
console.log('Migrations applied.');
