import 'server-only';
import { Redis } from '@upstash/redis';
import { env } from './env';

let client: Redis | null = null;

export function redis(): Redis {
  if (!client) {
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = env('redis');
    client = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
      automaticDeserialization: true,
    });
  }
  return client;
}
