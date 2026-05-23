import ky from 'ky';
import { useAuthStore } from '../stores/authStore';

type ApiErrorPayload = {
  detail?: unknown;
};

// API logging: enabled in dev, disabled in tests via overrideApi({ logs: false })
let _apiLogsEnabled = import.meta.env.DEV;

const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const apiPrefix = apiBaseUrl ? `${apiBaseUrl}/api` : '/api';

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiPrefix}${normalizedPath}`;
}

export function getApiUrlWithSearchParams(
  path: string,
  searchParams: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  if (!queryString) {
    return getApiUrl(path);
  }

  const url = getApiUrl(path);
  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
}

// Instance Ky configurée pour l'API backend
// eslint-disable-next-line import/no-mutable-exports
export let api = ky.create({
  prefix: apiPrefix,
  timeout: 30000, // 30 secondes
  retry: {
    limit: 2, // Retry 2 fois en cas d'échec
    methods: ['get'], // Retry seulement GET
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      ({ request }) => {
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
      async ({ request, response }) => {
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

export async function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !('response' in error)) {
    return fallback;
  }

  const response = error.response;
  if (!(response instanceof Response)) {
    return fallback;
  }

  try {
    const payload = (await response.clone().json()) as ApiErrorPayload;
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    // Keep the user-facing fallback when the response is not JSON.
  }

  return fallback;
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
