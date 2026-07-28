import { http, HttpResponse } from 'msw';
import type { CacheKeyDetail } from '../hooks/admin/useCache';
import type { VideoExportJob } from '../hooks/flights/useVideoExportJobs';

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
  } | null;
}

const initialEntries: CacheEntry[] = [
  {
    key: 'weather:forecast:abc123',
    resolved: {
      type: 'weather_forecast',
      label: 'weather_forecast',
      confidence: 'high',
      details: {
        day_index: 0,
        site_code: 'arguel',
        site_name: 'Arguel',
      },
    },
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
    resolved: null,
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
    resolved: null,
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
    resolved: {
      type: 'best_spot',
      label: 'best_spot_for_day',
      confidence: 'high',
      details: {
        day_index: 0,
      },
    },
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
    resolved: {
      type: 'best_spot',
      label: 'best_spot_for_day',
      confidence: 'high',
      details: {
        day_index: 1,
      },
    },
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
    resolved: {
      type: 'emagram_sounding',
      label: 'emagram_sounding',
      confidence: 'high',
      details: {
        station: '07145',
        sounding_hour: '12',
        date: '2026-01-15',
      },
    },
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

const intervalsStatus = {
  configured: true,
  activity_types: ['Paragliding'],
};

const initialMockVideoJobs: VideoExportJob[] = [
  {
    job_id: 'job-arguel-running',
    flight_id: 'flight-arguel',
    flight_title: 'Arguel - soaring du soir',
    status: 'processing',
    internal_status: 'encoding',
    progress: 68,
    message: 'Encoding 68%',
    mode: 'manual_fast',
    started_at: '2026-01-15T09:15:00Z',
    updated_at: '2026-01-15T10:05:00Z',
    can_cancel: true,
    can_delete: true,
  },
  {
    job_id: 'job-chalais-completed',
    flight_id: 'flight-chalais',
    flight_title: 'Chalais - thermique bleu',
    status: 'completed',
    internal_status: 'completed',
    progress: 100,
    message: 'Video ready',
    mode: 'manual',
    started_at: '2026-01-14T12:20:00Z',
    completed_at: '2026-01-14T13:35:00Z',
    has_output_file: true,
    output_filename: 'chalais-export.mp4',
    can_cancel: false,
    can_delete: true,
  },
  {
    job_id: 'job-gopro-completed',
    flight_id: 'flight-chalais',
    flight_name: 'Chalais - thermique bleu',
    flight_title: 'final.mp4',
    status: 'completed',
    internal_status: 'completed',
    progress: 100,
    message: 'Overlay ready',
    mode: 'gopro_overlay',
    updated_at: '2026-01-14T14:05:00Z',
    completed_at: '2026-01-14T14:05:00Z',
    output_filename: 'final.mp4',
    layout_label: 'Overlay GoPro',
    has_output_file: true,
    can_cancel: false,
    can_delete: true,
  },
];

const mockVideoJobs: VideoExportJob[] = initialMockVideoJobs.map((job) => ({
  ...job,
}));

const resetMockVideoJobs = () => {
  mockVideoJobs.length = 0;
  mockVideoJobs.push(...initialMockVideoJobs.map((job) => ({ ...job })));
};

export const resetCacheDb = () => {
  cacheDb.length = 0;
  cacheDb.push(...initialEntries);
  resetMockVideoJobs();
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
        } | null;
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

    return null;
  };

  for (const entry of cacheDb) {
    const parts = entry.key.split(':');
    const prefix = parts.length >= 3 ? `${parts[0]}:${parts[1]}` : parts[0];

    if (!groups[prefix]) {
      groups[prefix] = { count: 0, keys: [] };
    }

    const resolved =
      typeof entry.resolved !== 'undefined'
        ? entry.resolved
        : resolveKey(entry.key);

    groups[prefix].count += 1;
    groups[prefix].keys.push({
      key: entry.key,
      ttl: entry.ttl,
      size: entry.size,
      resolved,
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

const intervalsHandlers = [
  http.get('*/api/admin/intervals/status', () =>
    HttpResponse.json(intervalsStatus)
  ),
];

export const intervalsNoActivityTypesHandlers = [
  http.get('*/api/admin/intervals/status', () =>
    HttpResponse.json({
      ...intervalsStatus,
      activity_types: [],
    })
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

      return null;
    };

    const entry = cacheDb.find((e) => e.key === key);
    if (!entry) {
      return new HttpResponse(null, { status: 404 });
    }

    const resolved =
      typeof entry.resolved !== 'undefined' ? entry.resolved : resolveKey();

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
      resolved,
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

export const videoExportHandlers = [
  http.get('*/api/video-export-jobs', () =>
    HttpResponse.json({
      jobs: mockVideoJobs,
    })
  ),

  http.delete('*/api/exports/:jobId/cancel', ({ params }) => {
    const job = mockVideoJobs.find((item) => item.job_id === params.jobId);
    if (job) {
      const now = new Date().toISOString();
      job.status = 'cancelled';
      job.internal_status = 'cancelled';
      job.can_cancel = false;
      job.cancelled_at = now;
      job.updated_at = now;
      job.message = 'Cancelled';
    }

    return HttpResponse.json({ success: true });
  }),

  http.post('*/api/exports/:jobId/resume', ({ params }) => {
    const job = mockVideoJobs.find((item) => item.job_id === params.jobId);
    if (job) {
      job.status = 'processing';
      job.internal_status = 'queued';
      job.can_cancel = true;
      job.can_resume = false;
      job.message = 'Resume enqueued';
    }

    return HttpResponse.json({ success: true });
  }),

  http.delete('*/api/video-export-jobs/:jobId', ({ params }) => {
    const index = mockVideoJobs.findIndex(
      (item) => item.job_id === params.jobId
    );
    if (index !== -1) {
      mockVideoJobs.splice(index, 1);
    }

    return HttpResponse.json({ success: true, deleted: true });
  }),

  http.delete('*/api/exports/:jobId/video', ({ params }) => {
    const job = mockVideoJobs.find((item) => item.job_id === params.jobId);
    if (job) {
      job.has_output_file = false;
    }

    return HttpResponse.json({ success: true, deleted: true });
  }),

  http.delete('*/api/gopro-overlays/jobs/:jobId/video', ({ params }) => {
    const job = mockVideoJobs.find((item) => item.job_id === params.jobId);
    if (job) {
      job.has_output_file = false;
    }

    return HttpResponse.json({ success: true, deleted: true });
  }),
];

export const defaultHandlers = [
  ...intervalsHandlers,
  ...cacheHandlers,
  ...videoExportHandlers,
];
