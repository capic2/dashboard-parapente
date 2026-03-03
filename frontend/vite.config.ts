/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cesium from 'vite-plugin-cesium';

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), tailwindcss(), cesium({ cesiumBuildRootPath: 'node_modules/cesium/Build' })],
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
    outDir: 'dist',
    sourcemap: false,
    // Code splitting for TanStack Router routes
    rollupOptions: {
      output: {
        manualChunks: {
          'tanstack-router': ['@tanstack/react-router'],
          'tanstack-query': ['@tanstack/react-query'],
          'tanstack-table': ['@tanstack/react-table'],
          'tanstack-form': ['@tanstack/react-form']
        }
      }
    }
  }
});