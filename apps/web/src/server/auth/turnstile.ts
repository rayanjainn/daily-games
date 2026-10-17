import 'server-only';
import { env } from '../env';

/** Optional Cloudflare Turnstile check, behind FEATURE_TURNSTILE. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const { FEATURE_TURNSTILE, TURNSTILE_SECRET_KEY } = env('bot');
  if (!FEATURE_TURNSTILE) return true;
  if (!token || !TURNSTILE_SECRET_KEY) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  return data.success === true;
}
