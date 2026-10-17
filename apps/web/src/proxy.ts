import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before every page and API request:
 *  - issues the CSRF double-submit cookie when missing
 *  - sets a nonce-based Content-Security-Policy and other security headers on pages
 */
const CSRF_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-ed_csrf' : 'ed_csrf';

function csp(nonce: string, isDev: boolean) {
  const realtime = process.env.REALTIME_URL ? new URL(process.env.REALTIME_URL).origin : '';
  const turnstile =
    process.env.FEATURE_TURNSTILE === '1' ? ' https://challenges.cloudflare.com' : '';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}${turnstile}`,
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ''}`,
    // Inline style attributes (accent colors, progress values) are low-risk and widely used.
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'${realtime ? ` ${realtime} ${realtime.replace(/^http/, 'ws')}` : ''}${isDev ? ' ws:' : ''}`,
    `frame-src 'self' https:${turnstile}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const isPage = !request.nextUrl.pathname.startsWith('/api/');
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const requestHeaders = new Headers(request.headers);
  if (isPage) requestHeaders.set('x-nonce', nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!request.cookies.get(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, crypto.randomUUID().replace(/-/g, ''), {
      httpOnly: false, // read by our own fetch helper and echoed in a header
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:',
      path: '/',
    });
  }

  if (isPage) {
    response.headers.set('Content-Security-Policy', csp(nonce, isDev));
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), payment=()',
  );
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (!isDev)
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
