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
  plugins: [
    react(),
    tailwindcss(),
  ],
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
        }
      },
      {
        plugins: [
          react(),
          tailwindcss(),
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          globals: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium', launch: { headless: true } },
            ],
          },
          exclude: [
            'node_modules',
            'dist',
            '**/FlightViewer3D.stories.tsx',
            '**/EmagramWidget.stories.tsx',
          ],
          testTimeout: 15000,
          setupFiles: [],
        },
      },
    ],
  },
})
