import { http, HttpResponse } from 'msw';
import type { CacheKeyDetail } from '../hooks/admin/useCache';
import type { TokenLog } from '../hooks/admin/useStravaToken';

// --- In-memory cache database ---

interface CacheEntry {
  key: string;
  ttl: number;
  size: number;
  value: string; // JSON-serialized
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

let stravaTokenState = {
  valid: true,
  expires_at: '2026-01-15T16:00:00Z',
};

let nextLogId = 4;

const stravaTokenLogs: TokenLog[] = [
  {
    id: 3,
    timestamp: '2026-01-15T10:00:00Z',
    success: true,
    message: 'Access token refreshed (expires at 2026-01-15 16:00:00)',
    expires_at: '2026-01-15T16:00:00Z',
  },
  {
    id: 2,
    timestamp: '2026-01-15T06:00:00Z',
    success: true,
    message: 'Access token refreshed (expires at 2026-01-15 12:00:00)',
    expires_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 1,
    timestamp: '2026-01-15T02:00:00Z',
    success: false,
    message:
      'Strava API error (HTTP 401): {"message":"Bad Request","errors":[]}',
    expires_at: null,
  },
];

const initialStravaLogs = [...stravaTokenLogs];

export const resetCacheDb = () => {
  cacheDb.length = 0;
  cacheDb.push(...initialEntries);
  // Reset Strava state
  stravaTokenState = { valid: true, expires_at: '2026-01-15T16:00:00Z' };
  stravaTokenLogs.length = 0;
  stravaTokenLogs.push(...initialStravaLogs);
  nextLogId = 4;
};

// --- Helper: build overview response from cacheDb ---

function buildOverview() {
  const groups: Record<
    string,
    { count: number; keys: { key: string; ttl: number; size: number }[] }
  > = {};

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
    HttpResponse.json(stravaTokenState)
  ),

  http.get('*/api/admin/strava/token-logs', () =>
    HttpResponse.json(stravaTokenLogs)
  ),

  http.post('*/api/admin/strava/refresh-token', () => {
    const newExpiry = '2026-01-15T22:00:00Z';
    stravaTokenState = { valid: true, expires_at: newExpiry };
    stravaTokenLogs.unshift({
      id: nextLogId++,
      timestamp: new Date().toISOString(),
      success: true,
      message: `Access token refreshed (expires at ${newExpiry})`,
      expires_at: newExpiry,
    });
    return HttpResponse.json({
      valid: true,
      expires_at: newExpiry,
      refreshed: true,
    });
  }),
];

export const stravaExpiredHandlers = [
  http.get('*/api/admin/strava/token-status', () =>
    HttpResponse.json({
      valid: false,
      expires_at: '2026-01-14T10:00:00Z',
    })
  ),

  http.get('*/api/admin/strava/token-logs', () =>
    HttpResponse.json([
      {
        id: 1,
        timestamp: '2026-01-15T02:00:00Z',
        success: false,
        message:
          'Strava API error (HTTP 401): {"message":"Bad Request","errors":[]}',
        expires_at: null,
      },
    ])
  ),

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
