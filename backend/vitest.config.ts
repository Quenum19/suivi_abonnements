import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: true,
    globalSetup: ['test/setup/global.ts'],
    setupFiles: ['test/setup/env.ts'],
    fileParallelism: false,
  },
});
