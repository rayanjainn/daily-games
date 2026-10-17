import { createDb } from '@everydaily/shared/db';
import {
  createHealthStore,
  runHealthChecks,
  type HealthSummary,
  type PageCheck,
} from '@everydaily/shared/catalog/health';
import type { Env } from './env';

/**
 * Keep in sync with [triggers] in wrangler.toml. Not exported from index.ts: a worker's main
 * module may only export handlers and Durable Object classes.
 */
export const HEALTH_CRON = '17 4 * * *';

/** Requests a game page and keeps only status and framing headers (the body is discarded). */
export async function checkPage(url: string): Promise<PageCheck> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; EveryDailyHealth/1.0; +https://everydaily.raycode.tech)',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  await res.body?.cancel();
  return {
    ok: res.status < 400,
    status: res.status,
    finalUrl: res.url || url,
    xFrameOptions: res.headers.get('x-frame-options'),
    csp: res.headers.get('content-security-policy'),
    error: res.status < 400 ? null : `HTTP ${res.status}`,
  };
}

/** Daily cron: health of every game URL, plus a framing check for iframe games. */
export async function runDailyHealth(env: Env): Promise<HealthSummary> {
  const { db, client } = createDb(env.HYPERDRIVE.connectionString, { max: 4 });
  try {
    const summary = await runHealthChecks({
      store: createHealthStore(db),
      checkPage,
      embedderOrigin: env.APP_URL,
    });
    console.log(JSON.stringify({ level: 'info', msg: 'game health run', ...summary }));
    return summary;
  } finally {
    await client.end({ timeout: 5 });
  }
}
