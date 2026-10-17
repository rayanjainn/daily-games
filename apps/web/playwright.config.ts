import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT, E2E_REDIS_DB, REDIS_URL, SERVER_ENV, SHIM_PORT } from './e2e/support/env';

const BASE_URL = `http://localhost:${E2E_PORT}`;

// Lets offline emulation and routing reach requests made by the service worker itself.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';

/**
 * Projects:
 *  - e2e:          functional + accessibility specs (needs Postgres and Redis running)
 *  - visual:       toHaveScreenshot baselines (pinned CI image only, VISUAL=1)
 *  - screenshots:  review captures written to docs/screenshots/<branch>/ (only with SHOTS_DIR)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/support/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // A service worker would hide requests from page.route; pwa.spec.ts opts back in.
    serviceWorkers: 'block',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: [/visual\.spec\.ts/, /screenshots\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual',
      testMatch: /visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx ../../scripts/dev/upstash-shim.ts',
      port: SHIM_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        SHIM_PORT: String(SHIM_PORT),
        REDIS_URL,
        REDIS_DB: String(E2E_REDIS_DB),
        SHIM_TOKEN: 'local-dev-token',
      },
    },
    {
      command: process.env.E2E_DEV
        ? `pnpm exec next dev --port ${E2E_PORT}`
        : `pnpm exec next build && pnpm exec next start --port ${E2E_PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: SERVER_ENV,
    },
  ],
});
