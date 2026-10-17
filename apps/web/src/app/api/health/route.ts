import { NextResponse } from 'next/server';
import { sql } from '@everydaily/shared/db';
import { db } from '@/server/db';
import { redis } from '@/server/redis';

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

async function probe(fn: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await withTimeout(fn(), 2_000);
    return { ok: true, ms: Date.now() - started };
  } catch {
    // No error details: this endpoint is public.
    return { ok: false, ms: Date.now() - started };
  }
}

/** Uptime check for the web app and the services it depends on. Public; reveals no details. */
export async function GET() {
  const [database, cache] = await Promise.all([
    probe(() => db().execute(sql`select 1`)),
    probe(() => redis().ping()),
  ]);
  const ok = database.ok && cache.ok;
  return NextResponse.json(
    { ok, service: 'web', checks: { database, redis: cache } },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
