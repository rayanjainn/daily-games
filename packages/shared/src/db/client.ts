import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>['db'];

/**
 * postgres.js + Drizzle. The same driver serves Vercel (Neon pooled URL), the worker
 * (Hyperdrive connection string) and local development.
 */
export function createDb(url: string, opts: { max?: number; prepare?: boolean } = {}) {
  const client = postgres(url, {
    max: opts.max ?? 5,
    // Neon's pooler (PgBouncer, transaction mode) does not support prepared statements.
    prepare: opts.prepare ?? false,
    onnotice: () => {},
  });
  return { db: drizzle(client, { schema, casing: 'snake_case' }), client };
}

export { schema };
