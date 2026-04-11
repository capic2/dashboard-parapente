import { http, HttpResponse } from 'msw';
import type { CacheKeyDetail } from '../hooks/admin/useCache';
import type { TokenLog } from '../hooks/admin/useStravaToken';

// --- In-memory cache database ---

interface CacheEntry {
  key: string;
  ttl: number;
  size: number;
  value: string; // JSON-serialized
  resolved?: {
    type: string;
    label: string;
    confidence: string;
    details?: Record<string, unknown>;
  };
}

const initialEntries: CacheEntry[] = [
  {
    key: 'weather:forecast:abc123',
    ttl: 3200,
    size: 2048,
    value: JSON.stringify({
      temperature: 18,
      wind_speed: 15,
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'weather:forecast:def456',
    ttl: 1800,
    size: 1536,
    value: JSON.stringify({
      temperature: 12,
      wind_speed: 20,
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'weather:forecast:ghi789',
    ttl: 900,
    size: 1024,
    value: JSON.stringify({
      temperature: 22,
      wind_speed: 8,
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'best_spot:day_0',
    ttl: 3000,
    size: 512,
    value: JSON.stringify({
      site: {
        id: 'site-arguel',
        name: 'Arguel',
        latitude: 47.2,
        longitude: 6.0,
      },
      paraIndex: 75,
      score: 75.0,
      verdict: 'BON',
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'best_spot:day_1',
    ttl: 2500,
    size: 480,
    value: JSON.stringify({
      site: { id: 'site-chalais', name: 'Chalais' },
      paraIndex: 60,
      score: 60.0,
      verdict: 'MOYEN',
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'emagram:sounding:07145:12:2026-01-15',
    ttl: 80000,
    size: 4096,
    value: JSON.stringify({
      success: true,
      station_code: '07145',
      data: [1, 2, 3],
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
];

export const cacheDb: CacheEntry[] = [...initialEntries];

// --- Strava token mock state ---

const STRAVA_MOCK_BASE_MS = Date.parse('2026-01-15T10:00:00Z');
const STRAVA_REFRESH_STEP_MS = 6 * 60 * 60 * 1000;

const getExpiresAt = (hours: number, base = STRAVA_MOCK_BASE_MS) =>
  new Date(base + hours * 60 * 60 * 1000).toISOString();

const buildStravaTokenState = (base = STRAVA_MOCK_BASE_MS) => ({
  valid: true,
  expires_at: getExpiresAt(1, base),
});

const buildStravaExpiredTokenState = (base = STRAVA_MOCK_BASE_MS) => ({
  valid: false,
  expires_at: getExpiresAt(-1, base),
});

let nextLogId = 4;
let currentRefreshClock = STRAVA_MOCK_BASE_MS;

const buildStravaTokenLogs = (base = STRAVA_MOCK_BASE_MS): TokenLog[] => [
  {
    id: 3,
    timestamp: getExpiresAt(-2, base),
    success: true,
    message: `Access token refreshed (expires at ${getExpiresAt(-1, base)})`,
    expires_at: getExpiresAt(-1, base),
  },
  {
    id: 2,
    timestamp: getExpiresAt(-6, base),
    success: true,
    message: `Access token refreshed (expires at ${getExpiresAt(-5, base)})`,
    expires_at: getExpiresAt(-5, base),
  },
  {
    id: 1,
    timestamp: getExpiresAt(-10, base),
    success: false,
    message:
      'Strava API error (HTTP 401): {"message":"Bad Request","errors":[]}',
    expires_at: null,
  },
];

const buildStravaExpiredTokenLogs = (
  base = STRAVA_MOCK_BASE_MS
): TokenLog[] => [
  {
    id: 1,
    timestamp: getExpiresAt(-1, base),
    success: false,
    message:
      'Strava API error (HTTP 401): {"message":"Bad Request","errors":[]}',
    expires_at: null,
  },
];

let currentStravaTokenState = buildStravaTokenState();
let currentStravaTokenLogs: TokenLog[] = buildStravaTokenLogs();

const refreshStravaToken = () => {
  currentRefreshClock += STRAVA_REFRESH_STEP_MS;
  const newExpiry = getExpiresAt(6, currentRefreshClock);
  const newLog: TokenLog = {
    id: nextLogId,
    timestamp: new Date(currentRefreshClock).toISOString(),
    success: true,
    message: `Access token refreshed (expires at ${newExpiry})`,
    expires_at: newExpiry,
  };

  nextLogId += 1;
  currentStravaTokenState = {
    valid: true,
    expires_at: newExpiry,
  };
  currentStravaTokenLogs = [newLog, ...currentStravaTokenLogs];

  return {
    valid: true,
    expires_at: newExpiry,
    refreshed: true,
  };
};

const getInitialStravaState = () => {
  nextLogId = 4;
  currentRefreshClock = STRAVA_MOCK_BASE_MS;
  currentStravaTokenState = buildStravaTokenState(currentRefreshClock);
  currentStravaTokenLogs = buildStravaTokenLogs(currentRefreshClock);
};

export const resetCacheDb = () => {
  cacheDb.length = 0;
  cacheDb.push(...initialEntries);
  // Reset Strava state
  getInitialStravaState();
};

// --- Helper: build overview response from cacheDb ---

function buildOverview() {
  const groups: Record<
    string,
    {
      count: number;
      keys: {
        key: string;
        ttl: number;
        size: number;
        resolved?: {
          type: string;
          label: string;
          confidence: string;
          details?: Record<string, unknown>;
        };
      }[];
    }
  > = {};

  const resolveKey = (key: string) => {
    if (key.startsWith('weather:forecast:')) {
      return {
        type: 'weather_forecast',
        label: 'weather_forecast',
        confidence: 'high',
        details: {
          day_index: 0,
          site_code: 'arguel',
          site_name: 'Arguel',
        },
      };
    }

    if (key.startsWith('best_spot:day_')) {
      return {
        type: 'best_spot',
        label: 'best_spot_for_day',
        confidence: 'high',
        details: {
          day_index: Number(key.replace('best_spot:day_', '')),
        },
      };
    }

    if (key.startsWith('emagram:sounding:')) {
      const parts = key.split(':');
      return {
        type: 'emagram_sounding',
        label: 'emagram_sounding',
        confidence: 'high',
        details: {
          station: parts[2] || '',
          sounding_hour: parts[3] || '',
          date: parts[4] || '',
        },
      };
    }

    return undefined;
  };

  for (const entry of cacheDb) {
    const parts = entry.key.split(':');
    const prefix = parts.length >= 3 ? `${parts[0]}:${parts[1]}` : parts[0];

    if (!groups[prefix]) {
      groups[prefix] = { count: 0, keys: [] };
    }
    groups[prefix].count += 1;
    groups[prefix].keys.push({
      key: entry.key,
      ttl: entry.ttl,
      size: entry.size,
      resolved: resolveKey(entry.key),
    });
  }

  return {
    total_keys: cacheDb.length,
    memory_usage: '1.2M',
    groups,
    truncated: false,
  };
}

// --- MSW handlers reading/modifying cacheDb ---

// --- Strava handlers ---

const stravaHandlers = [
  http.get('*/api/admin/strava/token-status', () =>
    HttpResponse.json(currentStravaTokenState)
  ),

  http.get('*/api/admin/strava/token-logs', () =>
    HttpResponse.json(currentStravaTokenLogs)
  ),

  http.post('*/api/admin/strava/refresh-token', () => {
    return HttpResponse.json(refreshStravaToken());
  }),
];

export const stravaExpiredHandlers = [
  http.get('*/api/admin/strava/token-status', () => {
    return HttpResponse.json(buildStravaExpiredTokenState());
  }),

  http.get('*/api/admin/strava/token-logs', () => {
    return HttpResponse.json(buildStravaExpiredTokenLogs());
  }),

  http.post('*/api/admin/strava/refresh-token', () =>
    HttpResponse.json(
      { detail: 'Strava token refresh failed' },
      { status: 502 }
    )
  ),
];

// --- Combined handlers ---

export const cacheHandlers = [
  http.get('*/api/admin/cache', () => HttpResponse.json(buildOverview())),

  http.get('*/api/admin/cache/:key', ({ request }) => {
    const url = new URL(request.url);
    const key = decodeURIComponent(
      url.pathname.replace(/.*\/api\/admin\/cache\//, '')
    );
    const resolveKey = () => {
      if (key.startsWith('weather:forecast:')) {
        return {
          type: 'weather_forecast',
          label: 'weather_forecast',
          confidence: 'high',
          details: {
            day_index: 0,
            site_code: 'arguel',
            site_name: 'Arguel',
          },
        };
      }

      if (key.startsWith('best_spot:day_')) {
        return {
          type: 'best_spot',
          label: 'best_spot_for_day',
          confidence: 'high',
          details: {
            day_index: Number(key.replace('best_spot:day_', '')),
          },
        };
      }

      if (key.startsWith('emagram:sounding:')) {
        const parts = key.split(':');
        return {
          type: 'emagram_sounding',
          label: 'emagram_sounding',
          confidence: 'high',
          details: {
            station: parts[2] || '',
            sounding_hour: parts[3] || '',
            date: parts[4] || '',
          },
        };
      }

      return undefined;
    };

    const entry = cacheDb.find((e) => e.key === key);
    if (!entry) {
      return new HttpResponse(null, { status: 404 });
    }
    let value: unknown;
    let type: 'json' | 'string';
    try {
      value = JSON.parse(entry.value);
      type = 'json';
    } catch {
      value = entry.value;
      type = 'string';
    }
    return HttpResponse.json({
      key: entry.key,
      ttl: entry.ttl,
      size: entry.size,
      value,
      type,
      resolved: resolveKey(),
    } satisfies CacheKeyDetail);
  }),

  http.delete('*/api/admin/cache/:key', ({ request }) => {
    const url = new URL(request.url);
    const key = decodeURIComponent(
      url.pathname.replace(/.*\/api\/admin\/cache\//, '')
    );

    if (key.includes('*')) {
      const pattern = key.replace(/\*/g, '');
      const before = cacheDb.length;
      for (let i = cacheDb.length - 1; i >= 0; i--) {
        if (cacheDb[i].key.startsWith(pattern)) {
          cacheDb.splice(i, 1);
        }
      }
      return HttpResponse.json({
        success: true,
        keys_deleted: before - cacheDb.length,
      });
    }

    const index = cacheDb.findIndex((e) => e.key === key);
    if (index !== -1) {
      cacheDb.splice(index, 1);
      return HttpResponse.json({ success: true, keys_deleted: 1 });
    }
    return HttpResponse.json({ success: true, keys_deleted: 0 });
  }),
];

export const defaultHandlers = [...stravaHandlers, ...cacheHandlers];
