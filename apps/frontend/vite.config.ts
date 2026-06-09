/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cesium from 'vite-plugin-cesium';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

const cesiumBuildRootPath = path.resolve(__dirname, '../../node_modules/cesium/Build');
const cesiumBuildPath = path.join(cesiumBuildRootPath, 'Cesium');
const workspaceRoot = path.resolve(__dirname, '../..');

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  root: __dirname,
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(workspaceRoot, 'node_modules/react'),
      'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
    },
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: path.resolve(__dirname, './src/routes'),
      generatedRouteTree: path.resolve(__dirname, './src/routeTree.gen.ts'),
      quoteStyle: 'single',
    }),
    react(),
    tailwindcss(),
    cesium({ cesiumBuildRootPath, cesiumBuildPath }),
  ],

  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../../dist/apps/frontend',
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // Cesium is lazy-loaded via route splitting, no manual chunk needed
          if (id.includes('node_modules/@tanstack')) {
            return 'vendor-tanstack';
          }
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          if (id.includes('node_modules/react-aria-components') || id.includes('node_modules/@react-aria') || id.includes('node_modules/@react-stately')) {
            return 'vendor-react-aria';
          }
        },
      },
    },
  },
});
