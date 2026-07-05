import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import {
  BackendWeatherResponseSchema,
  LocationSearchResponseSchema,
  NearbyFlightOptionsResponseSchema,
} from '@dashboard-parapente/shared-types';
import type {
  BackendWeatherResponse,
  LocationSearchResponse,
  NearbyFlightOptionsResponse,
} from '@dashboard-parapente/shared-types';

export const useLocationSearch = (query: string, limit = 5) => {
  const trimmedQuery = query.trim();

  return useQuery<LocationSearchResponse>({
    queryKey: ['locations', 'search', trimmedQuery, limit],
    queryFn: async () => {
      const data = await api
        .get('locations/search', {
          searchParams: { query: trimmedQuery, country: 'FR', limit },
        })
        .json();
      return LocationSearchResponseSchema.parse(data);
    },
    enabled: trimmedQuery.length >= 3,
    staleTime: getStaleTime(1000 * 60 * 60 * 24),
  });
};

export const useNearbyFlightOptions = (
  location: {
    latitude: number;
    longitude: number;
    name: string;
    display_name: string;
  } | null,
  radiusKm: number,
  limit: number
) => {
  return useQuery<NearbyFlightOptionsResponse>({
    queryKey: [
      'locations',
      'nearby-flight-options',
      location?.latitude,
      location?.longitude,
      radiusKm,
      limit,
    ],
    queryFn: async () => {
      if (!location) throw new Error('Location is required');
      const data = await api
        .get('locations/nearby-flight-options', {
          searchParams: {
            lat: location.latitude,
            lon: location.longitude,
            name: location.name,
            display_name: location.display_name,
            radius_km: radiusKm,
            limit,
          },
        })
        .json();
      return NearbyFlightOptionsResponseSchema.parse(data);
    },
    enabled: !!location,
    staleTime: getStaleTime(1000 * 60 * 10),
  });
};

export const createCoordinateWeatherQueryFn =
  (
    location: { latitude: number; longitude: number; name: string },
    dayIndex: number,
    forceRefresh = false
  ) =>
  async () => {
    const data = await api
      .get('weather/coordinates', {
        searchParams: {
          lat: location.latitude,
          lon: location.longitude,
          name: location.name,
          day_index: dayIndex,
          ...(forceRefresh ? { force_refresh: true } : {}),
        },
      })
      .json();
    return BackendWeatherResponseSchema.parse(data);
  };

export const useCoordinateWeather = (
  location: { latitude: number; longitude: number; name: string } | null,
  dayIndex: number
) => {
  return useQuery<BackendWeatherResponse>({
    queryKey: [
      'weather',
      'coordinates',
      location?.latitude,
      location?.longitude,
      location?.name,
      dayIndex,
    ],
    queryFn: location
      ? createCoordinateWeatherQueryFn(location, dayIndex)
      : () => {
          throw new Error('Location is required');
        },
    enabled: !!location,
    staleTime: getStaleTime(1000 * 60 * 30),
  });
};
