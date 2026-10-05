import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import type { GeoPoint } from '../../types/flight';

export interface GPXData {
  coordinates: GeoPoint[];
  max_altitude_m: number;
  min_altitude_m: number;
  altitude_range_m?: number;
  takeoff_altitude_m?: number;
  landing_altitude_m?: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  total_distance_km: number;
  max_distance_from_takeoff_km?: number;
  flight_duration_seconds: number;
  average_speed_kmh?: number;
  max_speed_kmh?: number;
  max_climb_rate_ms?: number;
  max_sink_rate_ms?: number;
}

type ExportViewerAccess = {
  exportJobId?: string | null;
  exportToken?: string | null;
};

/**
 * Fetch GPX data for a specific flight
 * Returns parsed coordinates and elevation profile
 */
export const useFlightGPX = (
  flightId: string,
  access: ExportViewerAccess = {},
  enabled = true
) => {
  const hasExportAccess = Boolean(access.exportJobId && access.exportToken);

  return useQuery<GPXData>({
    queryKey: [
      'flights',
      flightId,
      'gpx',
      hasExportAccess ? 'export-viewer' : 'user',
      access.exportJobId ?? null,
    ],
    queryFn: async () => {
      const data = await api
        .get(
          hasExportAccess
            ? `export-viewer/jobs/${access.exportJobId}/gpx-data`
            : `flights/${flightId}/gpx-data`,
          hasExportAccess
            ? { searchParams: { access_token: access.exportToken ?? '' } }
            : undefined
        )
        .json<{ data: GPXData }>();
      return data.data;
    },
    enabled: !!flightId && enabled,
    staleTime: getStaleTime(1000 * 60 * 60), // 1 hour
  });
};
