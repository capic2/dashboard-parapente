import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';

type WeatherSearch = {
  siteId?: string;
  day?: number;
  target?: 'city' | 'takeoff' | 'landing';
  city?: string;
  displayName?: string;
  spotId?: string;
  spotName?: string;
  spotType?: 'takeoff' | 'landing' | 'both';
  lat?: number;
  lon?: number;
  elevation?: number;
  orientation?: string;
  country?: string;
  source?: string;
};

const parseOptionalNumber = (value: unknown) => {
  const parsed =
    typeof value === 'string' || typeof value === 'number'
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export const Route = createFileRoute('/weather')({
  validateSearch: (search: Record<string, unknown>): WeatherSearch => {
    const rawDay = search.day;
    const parsedDay =
      typeof rawDay === 'string' || typeof rawDay === 'number'
        ? Number(rawDay)
        : Number.NaN;
    const target =
      search.target === 'city' ||
      search.target === 'takeoff' ||
      search.target === 'landing'
        ? search.target
        : undefined;
    const spotType =
      search.spotType === 'takeoff' ||
      search.spotType === 'landing' ||
      search.spotType === 'both'
        ? search.spotType
        : undefined;

    return {
      siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
      day:
        Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay <= 6
          ? parsedDay
          : undefined,
      target,
      city: parseString(search.city),
      displayName: parseString(search.displayName),
      spotId: parseString(search.spotId),
      spotName: parseString(search.spotName),
      spotType,
      lat: parseOptionalNumber(search.lat),
      lon: parseOptionalNumber(search.lon),
      elevation: parseOptionalNumber(search.elevation),
      orientation: parseString(search.orientation),
      country: parseString(search.country),
      source: parseString(search.source),
    };
  },
  loader: () => {
    void queryClient.prefetchQuery(sitesQueryOptions());
  },
});
