import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import type { GeoPoint } from '../../types/flight';

interface GPXData {
  coordinates: GeoPoint[];
  max_altitude_m: number;
  min_altitude_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  total_distance_km: number;
  flight_duration_seconds: number;
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
  access: ExportViewerAccess = {}
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
      console.log('🔍 DEBUG useFlightGPX - Raw API response:', data);
      console.log(
        '🔍 DEBUG useFlightGPX - First 3 coords from API:',
        data.data?.coordinates?.slice(0, 3)
      );
      return data.data;
    },
    enabled: !!flightId,
    staleTime: getStaleTime(1000 * 60 * 60), // 1 hour
  });
};
