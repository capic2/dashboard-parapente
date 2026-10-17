import ky from 'ky';
import { useAuthStore } from '../stores/authStore';

type ApiErrorPayload = {
  detail?: unknown;
};

const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/u, '');
const appBasePath = import.meta.env.BASE_URL.replace(/\/$/u, '');
const apiPrefix = apiBaseUrl ? `${apiBaseUrl}/api` : `${appBasePath}/api`;

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
      },
    ],
    afterResponse: [
      ({ response }) => {
        // On 401, clear auth and redirect to login
        if (response.status === 401) {
          const { isAuthenticated, logout } = useAuthStore.getState();
          if (isAuthenticated) {
            logout();
            window.location.href = `${appBasePath}/login`;
          }
        }

        return response;
      },
    ],
  },
});

// Override API configuration in tests.
export function overrideApi(options: Parameters<typeof api.extend>[0]) {
  api = api.extend(options);
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
    // Keep the fallback and HTTP status when the response is not JSON.
  }

  const status = response.statusText
    ? `${response.status} ${response.statusText}`
    : `${response.status}`;
  return `${fallback} (HTTP ${status})`;
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
