const PRELOAD_ERROR_RELOAD_KEY = 'vite-preload-error-reload-at';
const PRELOAD_ERROR_RELOAD_COOLDOWN_MS = 60_000;

export function registerPreloadErrorRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    let lastReloadAt: number;
    try {
      lastReloadAt = Number(
        window.sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY) || 0
      );
      if (Date.now() - lastReloadAt < PRELOAD_ERROR_RELOAD_COOLDOWN_MS) {
        return;
      }
      window.sessionStorage.setItem(
        PRELOAD_ERROR_RELOAD_KEY,
        String(Date.now())
      );
    } catch {
      return;
    }

    event.preventDefault();
    window.location.reload();
  });
}

export function clearPreloadErrorRecovery(): void {
  try {
    window.sessionStorage.removeItem(PRELOAD_ERROR_RELOAD_KEY);
  } catch {
    // Storage can be disabled; the recovery handler also tolerates that case.
  }
}
