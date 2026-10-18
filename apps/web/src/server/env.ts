import 'server-only';
import { z } from 'zod';

/**
 * Server env, validated lazily per feature so a missing realtime key does not break sign-in
 * (and vice versa). Each getter throws a readable error on first use.
 */
const bool = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

const groups = {
  core: z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    /** 32+ random bytes; signs gate tokens and the recovery confirmation. */
    AUTH_SECRET: z.string().min(32),
  }),
  redis: z.object({
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  }),
  webauthn: z.object({
    WEBAUTHN_RP_ID: z.string().min(1),
    WEBAUTHN_RP_NAME: z.string().min(1).default('EveryDaily'),
    WEBAUTHN_ORIGIN: z.string().url(),
  }),
  bot: z.object({
    POW_DIFFICULTY: z.coerce.number().int().min(8).max(24).default(16),
    FEATURE_TURNSTILE: bool,
    TURNSTILE_SECRET_KEY: z.string().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  }),
  features: z.object({
    /** "off", "admin" (mods and admins only, the launch default) or "all" signed-in players */
    FEATURE_SUBMISSIONS: z.enum(['off', 'admin', 'all']).default('admin'),
  }),
  email: z.object({
    /** Optional: email verification and email reminders are off without both. */
    RESEND_API_KEY: z.string().min(8).optional(),
    EMAIL_FROM: z.string().min(3).optional(),
    /** Local development and tests only (APP_URL on localhost): write emails as JSON files here. */
    EMAIL_DEV_OUTBOX: z.string().optional(),
  }),
  push: z.object({
    /** VAPID public key (base64url); without it the Reminders section explains it is off. */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(80).optional(),
  }),
  observability: z.object({
    /** Optional: unexpected errors are also posted here (a chat webhook or error tracker). */
    ERROR_WEBHOOK_URL: z.string().url().optional(),
    /** "1" logs every API request, not only failures and slow ones. */
    LOG_REQUESTS: bool,
  }),
  realtime: z.object({
    REALTIME_URL: z.string().url(),
    WORKER_INTERNAL_URL: z.string().url(),
    REALTIME_SIGNING_KEY: z.string().min(40),
    INTERNAL_BROADCAST_SECRET: z.string().min(16),
  }),
} as const;

type Groups = typeof groups;
const cache = new Map<keyof Groups, unknown>();

export function env<K extends keyof Groups>(group: K): z.infer<Groups[K]> {
  if (!cache.has(group)) {
    const res = groups[group].safeParse(process.env);
    if (!res.success) {
      const missing = res.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables (${group}): ${missing}`);
    }
    cache.set(group, res.data);
  }
  return cache.get(group) as z.infer<Groups[K]>;
}

/** Back-compat for the realtime routes. */
export const serverEnv = () => env('realtime');

export const isProduction = () => process.env.NODE_ENV === 'production';
