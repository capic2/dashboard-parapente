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
    testTimeout: 15000,
    setupFiles: [path.join(dirname, '.storybook/vitest.setup.ts')],
  },
})
