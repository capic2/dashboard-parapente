const PRELOAD_ERROR_RELOAD_KEY = 'vite-preload-error-reload-at';
const PRELOAD_ERROR_RELOAD_COOLDOWN_MS = 60_000;
let lastMemoryReloadAt = 0;

export function registerPreloadErrorRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    const now = Date.now();
    let lastReloadAt = lastMemoryReloadAt;
    try {
      lastReloadAt = Math.max(
        lastReloadAt,
        Number(window.sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY) || 0)
      );
    } catch {
      // Fall back to the in-memory cooldown when sessionStorage is blocked.
    }
    if (now - lastReloadAt < PRELOAD_ERROR_RELOAD_COOLDOWN_MS) return;

    lastMemoryReloadAt = now;
    try {
      window.sessionStorage.setItem(PRELOAD_ERROR_RELOAD_KEY, String(now));
    } catch {
      // The in-memory timestamp still prevents repeated reloads this session.
    }

    event.preventDefault();
    window.location.reload();
  });
}

export function clearPreloadErrorRecovery(): void {
  lastMemoryReloadAt = 0;
  try {
    window.sessionStorage.removeItem(PRELOAD_ERROR_RELOAD_KEY);
  } catch {
    // Storage can be disabled; the in-memory cooldown is cleared either way.
  }
}
