import 'server-only';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REALTIME_URL: z.string().url(),
  WORKER_INTERNAL_URL: z.string().url(),
  REALTIME_SIGNING_KEY: z.string().min(40),
  INTERNAL_BROADCAST_SECRET: z.string().min(16),
});

let cached: z.infer<typeof schema> | null = null;

/** Validated server env. Throws on first use if anything is missing. */
export function serverEnv() {
  cached ??= schema.parse(process.env);
  return cached;
}
