import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';

type WeatherSearch = {
  variant?: 'A' | 'B' | 'C';
  siteId?: string;
  day?: string;
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

const DAY_SEARCH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseLocalDate = (value: string) => {
  if (!DAY_SEARCH_DATE_RE.test(value)) return null;
  const [year = '', month = '', day = ''] = value.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
    ? date
    : null;
};

const getLocalDayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseForecastDaySearch = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const date = parseLocalDate(value);
  if (!date) return undefined;

  const today = getLocalDayStart(new Date());
  const dayIndex = Math.round((date.getTime() - today.getTime()) / DAY_MS);
  return dayIndex >= 0 && dayIndex <= 6 ? value : undefined;
};

export const Route = createFileRoute('/weather')({
  validateSearch: (search: Record<string, unknown>): WeatherSearch => {
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
      variant:
        search.variant === 'A' ||
        search.variant === 'B' ||
        search.variant === 'C'
          ? search.variant
          : undefined,
      siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
      day: parseForecastDaySearch(search.day),
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
