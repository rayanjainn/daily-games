/**
 * One JSON object per line, the shape log tools expect. Anything that looks like a secret is
 * replaced before the line is written, so a careless field can't leak a token into the logs.
 */
export type Level = 'debug' | 'info' | 'warn' | 'error';

const SECRET_KEY = /token|secret|password|authorization|cookie|phrase|key|hash|sharetext/i;
const MAX_STRING = 500;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…`
      : value;
  }
  if (depth > 3) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value))
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
  return out;
}

export function formatLine(
  level: Level,
  msg: string,
  fields: Record<string, unknown> = {},
  now = new Date(),
): string {
  return JSON.stringify({
    ts: now.toISOString(),
    level,
    msg,
    ...(redact(fields) as Record<string, unknown>),
  });
}

/** A short, stable description of an error that is safe to send to a webhook. */
export function describeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error)
    return {
      name: err.name,
      message: err.message.slice(0, MAX_STRING),
      stack: err.stack?.split('\n').slice(0, 12).join('\n'),
    };
  return { name: 'NonError', message: String(err).slice(0, MAX_STRING) };
}

/** Lets a given error through once per window, so a loop can't flood the webhook. */
export function createThrottle(windowMs = 60_000, now = () => Date.now()) {
  const seen = new Map<string, number>();
  return (key: string) => {
    const t = now();
    for (const [k, at] of seen) if (t - at > windowMs) seen.delete(k);
    if (seen.has(key)) return false;
    if (seen.size > 200) seen.clear();
    seen.set(key, t);
    return true;
  };
}
