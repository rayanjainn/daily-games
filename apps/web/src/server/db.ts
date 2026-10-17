import 'server-only';
import { createDb, type Database } from '@everydaily/shared/db';
import { env } from './env';

const globalForDb = globalThis as unknown as { __edDb?: ReturnType<typeof createDb> };

/** One pooled client per server instance (survives dev hot reloads). */
export function db(): Database {
  globalForDb.__edDb ??= createDb(env('core').DATABASE_URL, { max: 5 });
  return globalForDb.__edDb.db;
}
