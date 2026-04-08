import ky from 'ky';
import { useAuthStore } from '../stores/authStore';

// API logging: enabled in dev, disabled in tests via overrideApi({ logs: false })
let _apiLogsEnabled = import.meta.env.DEV;

// Instance Ky configurée pour l'API backend
// eslint-disable-next-line import/no-mutable-exports
export let api = ky.create({
  prefixUrl: '/api', // Toutes les requêtes préfixées par /api
  timeout: 30000, // 30 secondes
  retry: {
    limit: 2, // Retry 2 fois en cas d'échec
    methods: ['get'], // Retry seulement GET
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        // Attach JWT token if available
        const token = useAuthStore.getState().token;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }

        // Log requêtes en dev (désactivé en test via overrideApi)
        if (_apiLogsEnabled) {
          console.log(`[API] ${request.method} ${request.url}`);
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        // On 401, clear auth and redirect to login
        if (response.status === 401) {
          const { isAuthenticated, logout } = useAuthStore.getState();
          if (isAuthenticated) {
            logout();
            window.location.href = '/login';
          }
        }

        // Log des erreurs en dev (désactivé en test via overrideApi)
        if (!response.ok && _apiLogsEnabled) {
          console.error(
            `[API Error] ${request.method} ${request.url}:`,
            response.status
          );
        }
        return response;
      },
    ],
  },
});

// Override api configuration (used by test setup to disable retry and logs)
export function overrideApi(
  options: Parameters<typeof api.extend>[0] & { logs?: boolean }
) {
  const { logs, ...kyOptions } = options;
  if (logs !== undefined) {
    _apiLogsEnabled = logs;
  }
  api = api.extend(kyOptions);
}

// Apply persisted timeout on load and react to changes
import { useCacheSettingsStore } from '../stores/cacheSettingsStore';

const initialTimeout = useCacheSettingsStore.getState().httpTimeout;
if (initialTimeout !== 30000) {
  overrideApi({ timeout: initialTimeout });
}

useCacheSettingsStore.subscribe((state, prevState) => {
  if (state.httpTimeout !== prevState.httpTimeout) {
    overrideApi({ timeout: state.httpTimeout });
  }
});
