import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // PGlite integration tests boot + migrate + seed in beforeAll (~9s each);
    // under full-suite parallelism that can exceed vitest's 10s default.
    hookTimeout: 30_000,
  },
});
