import preview from '../../../.storybook/preview';
import AllSitesConditions from './AllSitesConditions';
import type { SiteWeatherEntry } from './AllSitesConditions';
import type { Site } from '@dashboard-parapente/shared-types';
import type { WeatherData } from '../../types';
import { expect } from 'storybook/test';

const makeSite = (id: string, name: string, orientation: string): Site =>
  ({
    id,
    name,
    code: id,
    orientation,
    latitude: 47.2,
    longitude: 6.0,
    elevation_m: 700,
    country: 'FR',
    is_active: true,
  }) as Site;

const makeWeather = (
  name: string,
  paraIndex: number,
  verdict: string,
  temp: number,
  windSpeed: number,
  windDir: string,
  conditions: string
): WeatherData => ({
  spot_name: name,
  para_index: paraIndex,
  score: paraIndex,
  verdict,
  temperature: temp,
  wind_speed: windSpeed,
  wind_direction: windDir,
  conditions,
  forecast_time: '2025-06-15T10:00:00Z',
  cached_at: '2025-06-15T10:00:00Z',
});

const threeEntries: SiteWeatherEntry[] = [
  {
    site: makeSite('site-1', 'Arguel', 'NW'),
    weather: makeWeather('Arguel', 82, 'bon', 22, 12, 'NW', 'Ensoleillé'),
    isLoading: false,
    isError: false,
  },
  {
    site: makeSite('site-2', 'Mont Poupet Sud', 'S'),
    weather: makeWeather(
      'Mont Poupet Sud',
      55,
      'moyen',
      18,
      22,
      'S',
      '45% nuages, Sec'
    ),
    isLoading: false,
    isError: false,
  },
  {
    site: makeSite('site-3', 'La Côte', 'W'),
    weather: makeWeather(
      'La Côte',
      28,
      'mauvais',
      12,
      35,
      'E',
      '85% nuages, 3mm pluie'
    ),
    isLoading: false,
    isError: false,
  },
];

const meta = preview.meta({
  title: 'Components/Dashboard/AllSitesConditions',
  component: AllSitesConditions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Grid of all configured sites showing current weather conditions. Click a card to navigate to the weather detail page.',
      },
    },
  },
  tags: ['autodocs'],
});

// Default with 3 sites - varied conditions
export const Default = meta.story({
  name: 'Default (3 Sites)',
  args: {
    entries: threeEntries,
  },
});

Default.test('displays all site cards', async ({ canvas }) => {
  await canvas.findByText('Arguel');
  await expect(canvas.getByText('Mont Poupet Sud')).toBeInTheDocument();
  await expect(canvas.getByText('La Côte')).toBeInTheDocument();
});

// Loading state
export const Loading = meta.story({
  name: 'Loading',
  args: {
    entries: threeEntries.map((e) => ({
      ...e,
      weather: undefined,
      isLoading: true,
      isError: false,
    })),
  },
});

// Single site
export const SingleSite = meta.story({
  name: 'Single Site',
  args: {
    entries: [threeEntries[0]],
  },
});

// Error state
export const ErrorState = meta.story({
  name: 'Error',
  args: {
    entries: threeEntries.map((e) => ({
      ...e,
      weather: undefined,
      isLoading: false,
      isError: true,
    })),
  },
});
