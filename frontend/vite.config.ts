/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://dashboard-backend:8000',
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
  },
  optimizeDeps: {
    include: ['cesium'],
    exclude: ['cesium/Build/Cesium/Widgets/widgets.css']
  }
});