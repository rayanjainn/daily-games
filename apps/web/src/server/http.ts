import 'server-only';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { z, ZodType } from 'zod';
import { safeEqual } from './crypto';
import { env } from './env';
import { log, reportError } from './log';
import { rateLimit, type LimitName } from './rate-limit';
import { COOKIE } from './request';
import { HttpError } from './session';

export { HttpError };

const MAX_BODY = 16 * 1024;
export const CSRF_HEADER = 'x-csrf-token';

export interface ErrorBody {
  error: { code: string; message: string; [k: string]: unknown };
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  const res = NextResponse.json<ErrorBody>({ error: { code, message, ...extra } }, { status });
  if (status === 429 && typeof extra.retryAfter === 'number')
    res.headers.set('retry-after', String(extra.retryAfter));
  return res;
}

/** Same-origin check plus double-submit CSRF token, for every state-changing request. */
async function assertCsrf() {
  const h = await headers();
  const appOrigin = new URL(env('core').APP_URL).origin;
  const origin = h.get('origin');
  if (origin !== appOrigin)
    throw new HttpError(403, 'bad_origin', 'Request blocked: unexpected origin.');
  const cookieToken = (await cookies()).get(COOKIE.csrf)?.value;
  const headerToken = h.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new HttpError(
      403,
      'bad_csrf',
      'Request blocked: missing or invalid CSRF token. Reload the page and try again.',
    );
  }
}

export async function enforceLimit(name: LimitName, key: string) {
  const res = await rateLimit(name, key);
  if (!res.ok)
    throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait a moment.', {
      retryAfter: res.retryAfter,
    });
}

/**
 * Wraps a POST/PATCH/DELETE route handler: CSRF + origin, JSON body with size cap, zod
 * validation, and consistent error responses.
 */
export function mutation<S extends ZodType>(
  schema: S,
  fn: (input: z.infer<S>, req: Request) => Promise<unknown>,
) {
  return async (req: Request) => {
    const startedAt = performance.now();
    let res: Response;
    try {
      await assertCsrf();
      const raw = await req.text();
      if (raw.length > MAX_BODY)
        throw new HttpError(413, 'too_large', 'Request body is too large.');
      let json: unknown = {};
      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch {
          throw new HttpError(400, 'bad_json', 'Request body must be JSON.');
        }
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        res = errorResponse(400, 'invalid_input', 'Some fields are invalid.', {
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      } else {
        const out = await fn(parsed.data, req);
        res =
          out instanceof Response
            ? out
            : NextResponse.json(out ?? { ok: true }, { headers: { 'cache-control': 'no-store' } });
      }
    } catch (err) {
      res = handleError(err, req);
    }
    logRequest(req, res, startedAt);
    return res;
  };
}

/** Wraps a GET route handler (no CSRF; must not change state). */
export function query(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    const startedAt = performance.now();
    let res: Response;
    try {
      const out = await fn(req);
      res =
        out instanceof Response
          ? out
          : NextResponse.json(out, { headers: { 'cache-control': 'no-store' } });
    } catch (err) {
      res = handleError(err, req);
    }
    logRequest(req, res, startedAt);
    return res;
  };
}

export function handleError(err: unknown, req?: Request) {
  if (err instanceof HttpError) return errorResponse(err.status, err.code, err.message, err.extra);
  reportError(err, {
    requestId: req?.headers.get('x-request-id'),
    path: req ? pathOf(req) : undefined,
  });
  return errorResponse(500, 'internal', 'Something went wrong on our side.');
}

const pathOf = (req: Request) => new URL(req.url).pathname;
const SLOW_MS = 1500;

/** One log line per API request: failures and slow ones always, the rest when LOG_REQUESTS=1. */
function logRequest(req: Request, res: Response, startedAt: number) {
  const ms = Math.round(performance.now() - startedAt);
  const failed = res.status >= 400;
  if (!failed && ms < SLOW_MS && !env('observability').LOG_REQUESTS) return;
  log(res.status >= 500 ? 'error' : failed || ms >= SLOW_MS ? 'warn' : 'info', 'request', {
    requestId: req.headers.get('x-request-id'),
    method: req.method,
    path: pathOf(req),
    status: res.status,
    ms,
  });
}
