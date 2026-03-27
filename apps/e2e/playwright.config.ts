import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Use absolute path for database to ensure consistency between global-setup and webServer
const backendDir = path.resolve(__dirname, '..', 'backend');
const dbPath = path.join(backendDir, 'test.db');
const absoluteDbUrl = `sqlite:///${dbPath}`;

// Run only Chromium in CI for speed, all browsers locally
const ciOnly = !!process.env.CI;

export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  outputDir: './test-results',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Additional browsers only run locally (not in CI for speed)
    ...(!ciOnly
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
          {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
          },
          {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
          },
          {
            name: 'iPad',
            use: { ...devices['iPad Pro'] },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: 'pnpm exec nx serve backend',
      url: 'http://localhost:8001/health',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 120 * 1000, // 2 minutes for backend startup
      env: {
        TESTING: 'false',
        BACKEND_DATABASE_URL: process.env.BACKEND_DATABASE_URL || absoluteDbUrl,
        BACKEND_WEATHERAPI_KEY: process.env.BACKEND_WEATHERAPI_KEY || 'test_key',
        BACKEND_METEOBLUE_API_KEY: process.env.BACKEND_METEOBLUE_API_KEY || 'test_key',
        BACKEND_STRAVA_VERIFY_TOKEN: process.env.BACKEND_STRAVA_VERIFY_TOKEN || 'PARAPENTE_E2E_TEST',
      },
    },
    {
      command: 'pnpm exec nx serve frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 60 * 1000, // 1 minute for frontend startup
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
