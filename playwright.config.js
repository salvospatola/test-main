import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Back to 1 for stability
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Run local dev server before starting tests
  webServer: {
    command: 'npm start',
    port: 3001,
    env: {
      PORT: '3001',
      MONGODB_URI: 'mongodb://localhost:27018/efg_nsu_dev',
      NODE_ENV: 'test',
      SEARCH_ENGINE: 'fallback',
      BASE_URL: 'http://localhost:3001'
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
