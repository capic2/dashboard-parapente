// oxlint-disable-next-line import/no-unassigned-import
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { server } from '../../mocks/server';
import { overrideApi } from '../lib/api';

// Use i18next's key-returning mode so tests stay independent of translations.
// This initializes react-i18next and avoids its missing-instance warning.
await i18n.use(initReactI18next).init({
  lng: 'cimode',
  fallbackLng: 'cimode',
  resources: {},
});

// Disable API logs in tests
overrideApi({});

// Setup MSW
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [] as number[];
  disconnect() {
    /* noop */
  }
  observe() {
    /* noop */
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {
    /* noop */
  }
} as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  disconnect() {
    /* noop */
  }
  observe() {
    /* noop */
  }
  unobserve() {
    /* noop */
  }
} as unknown as typeof ResizeObserver;
