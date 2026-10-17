import 'server-only';
import { cookies, headers } from 'next/headers';
import { env, isProduction } from './env';
import { randomToken } from './crypto';

/** Cookie names; `__Host-` requires Secure, which browsers allow on https and on localhost. */
export const COOKIE = {
  session: isProduction() ? '__Host-ed_session' : 'ed_session',
  csrf: isProduction() ? '__Host-ed_csrf' : 'ed_csrf',
  device: isProduction() ? '__Host-ed_device' : 'ed_device',
  challenge: isProduction() ? '__Host-ed_chal' : 'ed_chal',
} as const;

export const secureCookies = () => env('core').APP_URL.startsWith('https://') || isProduction();

/** Client IP as seen by the platform (Vercel sets x-forwarded-for; first hop is the client). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '0.0.0.0';
}

/** Long-lived random device id cookie (not tied to identity) for per-device limits. */
export async function deviceId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(COOKIE.device)?.value;
  if (!id || !/^[A-Za-z0-9_-]{20,64}$/.test(id)) {
    id = randomToken(18);
    jar.set(COOKIE.device, id, {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return id;
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get('user-agent')?.slice(0, 300) ?? null;
}
