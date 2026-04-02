import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { GeoPoint } from '../../types/flight';

interface GPXData {
  coordinates: GeoPoint[];
  max_altitude_m: number;
  min_altitude_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  total_distance_km: number;
  flight_duration_seconds: number;
}

/**
 * Fetch GPX data for a specific flight
 * Returns parsed coordinates and elevation profile
 */
export const useFlightGPX = (flightId: string) => {
  return useQuery<GPXData>({
    queryKey: ['flights', flightId, 'gpx'],
    queryFn: async () => {
      const data = await api
        .get(`flights/${flightId}/gpx-data`)
        .json<{ data: GPXData }>();
      console.log('🔍 DEBUG useFlightGPX - Raw API response:', data);
      console.log(
        '🔍 DEBUG useFlightGPX - First 3 coords from API:',
        data.data?.coordinates?.slice(0, 3)
      );
      return data.data;
    },
    enabled: !!flightId,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};
