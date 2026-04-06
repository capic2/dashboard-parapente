import { http, HttpResponse } from 'msw';
import type { CacheKeyDetail } from '../hooks/admin/useCache';

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

export const resetCacheDb = () => {
  cacheDb.length = 0;
  cacheDb.push(...initialEntries);
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

export const defaultHandlers = [
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
