import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'e2e/**', '.worktrees/**'],
    // PGlite integration tests boot + migrate + seed in beforeAll (~9s each);
    // under full-suite parallelism that can exceed vitest's 10s default.
    hookTimeout: 30_000,
  },
});
