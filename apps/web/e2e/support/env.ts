/** Environment for the server Playwright starts. Mirrors .env.example with test values. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const SHIM_PORT = Number(process.env.E2E_SHIM_PORT ?? 8089);
export const E2E_REDIS_DB = 1;

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://everydaily:everydaily@localhost:5432/everydaily_e2e';
export const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const SERVER_ENV: Record<string, string> = {
  APP_URL: `http://localhost:${E2E_PORT}`,
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_SECRET: 'e2e-only-secret-value-that-is-long-enough-0123456789',
  UPSTASH_REDIS_REST_URL: `http://localhost:${SHIM_PORT}`,
  UPSTASH_REDIS_REST_TOKEN: 'local-dev-token',
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_RP_NAME: 'EveryDaily',
  WEBAUTHN_ORIGIN: `http://localhost:${E2E_PORT}`,
  POW_DIFFICULTY: '12',
  ENABLE_STYLEGUIDE: '1',
  NEXT_TELEMETRY_DISABLED: '1',
};
