import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import type { LiveWindResponse } from '../../types';

const LiveWindStationSchema = z.object({
  id: z.string(),
  provider: z.string().nullable(),
  provider_id: z.string().nullable(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  altitude_m: z.number().nullable(),
  distance_km: z.number(),
  last_report_at: z.string().nullable(),
  age_minutes: z.number().int().nullable(),
  is_outdated: z.boolean(),
  wind_avg_kmh: z.number().nullable(),
  wind_min_kmh: z.number().nullable(),
  wind_max_kmh: z.number().nullable(),
  wind_direction_deg: z.number().nullable(),
  temperature_c: z.number().nullable(),
  cloud_ceiling_m: z.number().nullable(),
  source_url: z.string().nullable(),
});

const LiveWindResponseSchema = z.object({
  site_id: z.string(),
  site_name: z.string(),
  source: z.string(),
  radius_km: z.number(),
  stations: z.array(LiveWindStationSchema),
});

export const useLiveWind = (siteId: string | undefined) => {
  return useQuery({
    queryKey: ['live-wind', siteId],
    queryFn: async ({ signal }) => {
      if (!siteId) {
        throw new Error('Site ID is required');
      }
      const data = await api
        .get(`sites/${siteId}/live-wind`, { signal })
        .json<LiveWindResponse>();

      return LiveWindResponseSchema.parse(data);
    },
    enabled: !!siteId,
    staleTime: getStaleTime(1000 * 60),
  });
};
