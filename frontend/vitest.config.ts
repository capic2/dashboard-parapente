/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright';
import storybookTest from "@storybook/addon-vitest/vitest-plugin";
import path from "node:path";
import {fileURLToPath} from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/routeTree.gen.ts',
      ],
      // No global thresholds - only applied to unit tests
      all: false, // Only collect coverage from tested files
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'happy-dom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['node_modules', 'dist', '.storybook'],
          env: {
            VITE_API_URL: 'http://localhost:8001',
            VITE_ENABLE_MSW: 'false',
          },
          coverage: {
            enabled: true,
            // Disable thresholds for now - we have mostly Storybook tests
            // TODO: Re-enable when we have more unit tests
            // thresholds: {
            //   statements: 80,
            //   branches: 80,
            //   functions: 80,
            //   lines: 80,
            // },
          }
        }
      },
      {
        plugins: [
          react(),
          tailwindcss(),
          storybookTest({
            // The location of your Storybook config, main.js|ts
            configDir: path.join(dirname, '.storybook'),
            // This should match your package.json script to run Storybook
            // The --no-open flag will skip the automatic opening of a browser
            storybookScript: 'yarn storybook --no-open',
          }),
        ],
        test: {
          name: 'storybook',
          globals: true,
          // Exclude stories that require full browser environment (Cesium, etc.)
          exclude: [
            'node_modules',
            'dist',
            '**/FlightViewer3D.stories.tsx',
            '**/EmagramWidget.stories.tsx',
          ],
          // Enable browser mode
          browser: {
            enabled: true,
            // Make sure to install Playwright
            provider: playwright({}),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          testTimeout: 15000, // 15s per test (default is 5s)
          teardownTimeout: 10000, // 10s for cleanup
          setupFiles: ['./.storybook/vitest.setup.ts'],
          // Disable coverage for Storybook tests
          coverage: {
            enabled: false,
          }
        },
      },
    ],
  },
})
