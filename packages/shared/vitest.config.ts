import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'shared',
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    // DB tests share one database; run files sequentially to avoid cross-file truncation.
    fileParallelism: false,
  },
});
