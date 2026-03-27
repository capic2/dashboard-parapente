/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cesium from 'vite-plugin-cesium';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  root: __dirname,
  plugins: [
    TanStackRouterVite({
      routesDirectory: path.resolve(__dirname, './src/routes'),
      generatedRouteTree: path.resolve(__dirname, './src/routeTree.gen.ts'),
      quoteStyle: 'single',
    }),
    react(),
    tailwindcss(),
    cesium({ cesiumBuildRootPath: 'node_modules/cesium/Build' })
  ],

  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../../dist/apps/frontend',
    emptyOutDir: true,
    sourcemap: false,
    // Code splitting for TanStack Router routes
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tanstack/react-router')) return 'tanstack-router';
          if (id.includes('@tanstack/react-query')) return 'tanstack-query';
          if (id.includes('@tanstack/react-table')) return 'tanstack-table';
          if (id.includes('@tanstack/react-form')) return 'tanstack-form';
        }
      }
    }
  }
});