import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Use absolute path for database to ensure consistency between global-setup and webServer
const backendDir = path.resolve(__dirname, '..', 'backend');
const dbPath = path.join(backendDir, 'test.db');
const absoluteDbUrl = `sqlite:///${dbPath}`;
const e2eRuntimeDir = path.join(backendDir, 'e2e-runtime');

// Run only Chromium in CI for speed, all browsers locally
const ciOnly = !!process.env.CI;

export default defineConfig({
  testDir: './',
  globalSetup: './global-setup.ts',
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
      command: './node_modules/.bin/nx serve backend',
      url: 'http://localhost:8001/health',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 120 * 1000, // 2 minutes for backend startup
      env: {
        ENVIRONMENT: 'test',
        TESTING: 'false',
        BACKEND_DATABASE_URL: absoluteDbUrl,
        BACKEND_LOG_FILE: path.join(e2eRuntimeDir, 'dashboard.log'),
        BACKEND_GOPRO_OVERLAY_ROOT: path.join(e2eRuntimeDir, 'gopro-overlay'),
        BACKEND_GOPRO_OVERLAY_BIN: path.join(e2eRuntimeDir, 'gopro-overlay', 'gopro-dashboard.py'),
        BACKEND_GOPRO_OVERLAY_UPLOAD_DIR: path.join(e2eRuntimeDir, 'gopro-overlays', 'uploads'),
        BACKEND_GOPRO_OVERLAY_OUTPUT_DIR: path.join(e2eRuntimeDir, 'gopro-overlays', 'outputs'),
        BACKEND_GOPRO_OVERLAY_PARAGLIDING_ROOT: path.join(e2eRuntimeDir, 'paragliding'),
        BACKEND_GOPRO_OVERLAY_LAYOUT_DIR: path.join(e2eRuntimeDir, 'gopro-overlay-layouts'),
        BACKEND_VERSION_STATE_FILE: path.join(e2eRuntimeDir, 'version_state.json'),
        BACKEND_WEATHERAPI_KEY: process.env.BACKEND_WEATHERAPI_KEY || 'test_key',
        BACKEND_METEOBLUE_API_KEY: process.env.BACKEND_METEOBLUE_API_KEY || 'test_key',
        BACKEND_STRAVA_VERIFY_TOKEN: process.env.BACKEND_STRAVA_VERIFY_TOKEN || 'PARAPENTE_E2E_TEST',
        // Disable schedulers in E2E to avoid noisy background fetches and external API calls
        BACKEND_SCHEDULER_ENABLED: 'false',
        // Use fake Redis in E2E (no Redis service in CI)
        BACKEND_USE_FAKE_REDIS: 'true',
        // Authentication
        BACKEND_JWT_SECRET: process.env.BACKEND_JWT_SECRET || 'e2e-test-secret',
        BACKEND_ADMIN_EMAIL: process.env.BACKEND_ADMIN_EMAIL || 'e2e@test.local',
        BACKEND_ADMIN_PASSWORD: process.env.BACKEND_ADMIN_PASSWORD || 'e2e-test-password',
      },
    },
    {
      command:
        'bash -lc "set -o pipefail; echo [e2e:web] Building frontend; ./node_modules/.bin/nx build frontend --output-style=stream --skip-nx-cache; echo [e2e:web] Starting Vite preview; ./node_modules/.bin/vite preview --config apps/frontend/vite.config.ts --strictPort --host 127.0.0.1 --port 5173"',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 120 * 1000, // 2 minutes for build + preview startup
      env: {
        VITE_CESIUM_ION_TOKEN:
          process.env.VITE_CESIUM_ION_TOKEN || 'e2e-ci-placeholder-token',
      },
    },
  ],
});
