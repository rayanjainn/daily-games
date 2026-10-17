import { connect } from 'node:net';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { loadGames } from '@everydaily/shared/registry/loader';
import { seedGames } from '@everydaily/shared/registry/seed';
import { createDb } from '@everydaily/shared/db';
import { E2E_DATABASE_URL, E2E_REDIS_DB, REDIS_URL } from './env';

/** Fresh database (migrated + catalog seeded) and an empty Redis DB for every run. */
export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = postgres({ ...pgOptions(url), database: 'postgres', max: 1, onnotice: () => {} });
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (!exists.length) await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const client = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} });
  await client.unsafe(
    'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
  );
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(
      new URL('../../../../packages/shared/drizzle', import.meta.url),
    ),
  });
  await client.end();

  const { db, client: seedClient } = createDb(E2E_DATABASE_URL, { max: 1 });
  await seedGames(db, loadGames());
  await seedClient.end();

  await flushRedis();
}

function pgOptions(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

function flushRedis() {
  const u = new URL(REDIS_URL);
  return new Promise<void>((resolve, reject) => {
    const sock = connect(Number(u.port || 6379), u.hostname, () => {
      sock.write(`*2\r\n$6\r\nSELECT\r\n$1\r\n${E2E_REDIS_DB}\r\n*1\r\n$7\r\nFLUSHDB\r\n`);
    });
    let replies = '';
    sock.on('data', (d) => {
      replies += d.toString();
      if ((replies.match(/\r\n/g) ?? []).length >= 2) {
        sock.end();
        resolve();
      }
    });
    sock.on('error', reject);
  });
}
