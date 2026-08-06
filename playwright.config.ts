import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'DATABASE_URL= AUTH_SECRET=e2e-secret-with-at-least-32-characters AUTH_URL=http://127.0.0.1:3100 NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100 DEV_AUTH_BYPASS=true npm run dev -- --webpack --hostname 127.0.0.1 --port 3100',
    url: `${baseURL}/login`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
