import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  globalSetup: require.resolve('./global-setup'),
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
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    // Tablet
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },
  ],
  webServer: [
    {
      command: 'nx serve backend',
      url: 'http://localhost:8001/health',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 120 * 1000, // 2 minutes for backend startup
    },
    {
      command: 'nx serve frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 60 * 1000, // 1 minute for frontend startup
    },
  ],
});
