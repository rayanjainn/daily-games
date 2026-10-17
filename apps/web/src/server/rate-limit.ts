import 'server-only';
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { redis } from './redis';

/** Named limits. Keys are composed by callers (ip, device, username, user id). */
const LIMITS = {
  'username-check': { tokens: 30, window: '1 m' },
  'gate-start': { tokens: 20, window: '10 m' },
  'pow-challenge': { tokens: 20, window: '10 m' },
  'signup-ip': { tokens: 5, window: '1 h' },
  'signup-device': { tokens: 3, window: '1 h' },
  'login-options': { tokens: 30, window: '5 m' },
  'login-verify': { tokens: 20, window: '5 m' },
  'recover-ip': { tokens: 10, window: '15 m' },
  'pair-start': { tokens: 10, window: '10 m' },
  'pair-poll': { tokens: 120, window: '5 m' },
  'pair-approve': { tokens: 10, window: '10 m' },
  'passkey-add': { tokens: 10, window: '1 h' },
  'recovery-regen': { tokens: 5, window: '1 d' },
  follow: { tokens: 120, window: '5 m' },
  'game-report': { tokens: 10, window: '1 h' },
  submission: { tokens: 5, window: '1 d' },
  'admin-edit': { tokens: 120, window: '10 m' },
  'result-preview': { tokens: 120, window: '10 m' },
  'result-log': { tokens: 60, window: '10 m' },
  // Notes autosave while typing; generous but bounded.
  'note-save': { tokens: 240, window: '10 m' },
} as const satisfies Record<string, { tokens: number; window: Duration }>;

export type LimitName = keyof typeof LIMITS;

const limiters = new Map<LimitName, Ratelimit>();

function limiter(name: LimitName) {
  let l = limiters.get(name);
  if (!l) {
    const { tokens, window } = LIMITS[name];
    l = new Ratelimit({
      redis: redis(),
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(name, l);
  }
  return l;
}

export async function rateLimit(
  name: LimitName,
  key: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  const res = await limiter(name).limit(key);
  return { ok: res.success, retryAfter: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
}
