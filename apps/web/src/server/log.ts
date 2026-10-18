import 'server-only';
import {
  createThrottle,
  describeError,
  formatLine,
  type Level,
} from '@everydaily/shared/observability/log';
import { env } from './env';

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = formatLine(level, msg, fields);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

const allow = createThrottle();

/**
 * Logs an unexpected error and, when ERROR_WEBHOOK_URL is set, posts a short description of it
 * (a Slack-style `text` plus the fields) so it can reach a chat channel or an error tracker.
 * Never throws and never waits for the webhook.
 */
export function reportError(err: unknown, ctx: Record<string, unknown> = {}) {
  const d = describeError(err);
  log('error', 'unhandled error', { ...ctx, error: d.message, name: d.name, stack: d.stack });
  const url = env('observability').ERROR_WEBHOOK_URL;
  if (!url || !allow(`${d.name}:${d.message}`)) return;
  const body = JSON.stringify({
    text: `EveryDaily error: ${d.name}: ${d.message}`,
    ...JSON.parse(formatLine('error', 'unhandled error', { ...ctx, ...d })),
  });
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
}
