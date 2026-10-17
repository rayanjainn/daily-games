import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
  test: {
    name: 'worker',
    include: ['test/**/*.test.ts'],
  },
});
