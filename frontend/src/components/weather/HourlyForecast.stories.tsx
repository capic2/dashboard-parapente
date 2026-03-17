import preview from '../../../.storybook/preview';
import { expect, waitFor, userEvent } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import HourlyForecast from './HourlyForecast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Weather/HourlyForecast',
  component: HourlyForecast,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '1200px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

export default meta;

// Mock hourly forecast data
const mockHourlyForecastGood = [
  {
    hour: '10:00',
    para_index: 85,
    verdict: 'bon',
    temperature: 18,
    temp: 18,
    wind: 12,
    wind_speed: 12,
    wind_gust: 18,
    direction: 'NW',
    precipitation: 0,
    cape: 250,
    thermal_strength: 'Moyen',
    sources: {
      'open-meteo': {
        temperature: 18.2,
        wind_speed: 11.8,
        wind_gust: 17.5,
        wind_direction: 315,
        precipitation: 0,
        cloud_cover: 20,
      },
      'weatherapi': {
        temperature: 17.8,
        wind_speed: 12.2,
        wind_gust: 18.5,
        wind_direction: 310,
        precipitation: 0,
        cloud_cover: 25,
      },
    },
  },
  {
    hour: '11:00',
    para_index: 90,
    verdict: 'bon',
    temperature: 20,
    temp: 20,
    wind: 14,
    wind_speed: 14,
    wind_gust: 20,
    direction: 'NW',
    precipitation: 0,
    cape: 350,
    thermal_strength: 'Fort',
    sources: {
      'open-meteo': {
        temperature: 20.1,
        wind_speed: 13.9,
        wind_gust: 19.8,
        wind_direction: 320,
        precipitation: 0,
        cloud_cover: 15,
      },
      'weatherapi': {
        temperature: 19.9,
        wind_speed: 14.1,
        wind_gust: 20.2,
        wind_direction: 315,
        precipitation: 0,
        cloud_cover: 18,
      },
    },
  },
  {
    hour: '12:00',
    para_index: 88,
    verdict: 'bon',
    temperature: 22,
    temp: 22,
    wind: 15,
    wind_speed: 15,
    wind_gust: 22,
    direction: 'W',
    precipitation: 0,
    cape: 400,
    thermal_strength: 'Fort',
    sources: {
      'open-meteo': {
        temperature: 22.3,
        wind_speed: 15.2,
        wind_gust: 21.8,
        wind_direction: 280,
        precipitation: 0,
        cloud_cover: 10,
      },
      'weatherapi': {
        temperature: 21.7,
        wind_speed: 14.8,
        wind_gust: 22.2,
        wind_direction: 275,
        precipitation: 0,
        cloud_cover: 12,
      },
    },
  },
];

const mockHourlyForecastMixed = [
  {
    hour: '10:00',
    para_index: 75,
    verdict: 'moyen',
    temperature: 16,
    temp: 16,
    wind: 18,
    wind_speed: 18,
    wind_gust: 26,
    direction: 'NE',
    precipitation: 0.2,
    cape: 150,
    thermal_strength: 'Faible',
    sources: {
      'open-meteo': {
        temperature: 16.1,
        wind_speed: 17.8,
        wind_gust: 25.5,
        wind_direction: 45,
        precipitation: 0.1,
        cloud_cover: 45,
      },
      'weatherapi': {
        temperature: 15.9,
        wind_speed: 18.2,
        wind_gust: 26.5,
        wind_direction: 50,
        precipitation: 0.3,
        cloud_cover: 50,
      },
    },
  },
  {
    hour: '11:00',
    para_index: 45,
    verdict: 'limite',
    temperature: 15,
    temp: 15,
    wind: 25,
    wind_speed: 25,
    wind_gust: 32,
    direction: 'E',
    precipitation: 1.5,
    cape: 100,
    thermal_strength: 'Faible',
    sources: {
      'open-meteo': {
        temperature: 15.2,
        wind_speed: 24.8,
        wind_gust: 31.5,
        wind_direction: 90,
        precipitation: 1.2,
        cloud_cover: 75,
      },
      'weatherapi': {
        temperature: 14.8,
        wind_speed: 25.2,
        wind_gust: 32.5,
        wind_direction: 95,
        precipitation: 1.8,
        cloud_cover: 80,
      },
    },
  },
  {
    hour: '12:00',
    para_index: 30,
    verdict: 'mauvais',
    temperature: 14,
    temp: 14,
    wind: 32,
    wind_speed: 32,
    wind_gust: 42,
    direction: 'E',
    precipitation: 3.5,
    cape: 50,
    thermal_strength: 'Faible',
    sources: {
      'open-meteo': {
        temperature: 14.1,
        wind_speed: 31.8,
        wind_gust: 41.5,
        wind_direction: 88,
        precipitation: 3.2,
        cloud_cover: 95,
      },
      'weatherapi': {
        temperature: 13.9,
        wind_speed: 32.2,
        wind_gust: 42.5,
        wind_direction: 92,
        precipitation: 3.8,
        cloud_cover: 100,
      },
    },
  },
];

const mockWeatherWithHourly = {
  id: 1,
  spot_id: 1,
  spot_name: 'Annecy',
  para_index: 85,
  verdict: 'bon',
  temperature: 20,
  wind_speed: 12,
  wind_direction: 'NW',
  conditions: 'Ensoleillé',
  forecast_time: '2024-03-15T14:30:00Z',
  hourly_forecast: mockHourlyForecastGood,
};

const mockWeatherWithMixedHourly = {
  id: 1,
  spot_id: 1,
  spot_name: 'Annecy',
  para_index: 50,
  verdict: 'moyen',
  temperature: 15,
  wind_speed: 25,
  wind_direction: 'E',
  conditions: 'Variable',
  forecast_time: '2024-03-15T14:30:00Z',
  hourly_forecast: mockHourlyForecastMixed,
};

// Default story - Good conditions
export const GoodConditions = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherWithHourly);
        }),
      ],
    },
  },
});

// Mixed conditions (good, moderate, bad)
export const MixedConditions = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherWithMixedHourly);
        }),
      ],
    },
  },
});

// Empty hourly forecast
export const EmptyForecast = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json({
            ...mockWeatherWithHourly,
            hourly_forecast: [],
          });
        }),
      ],
    },
  },
});

// Loading state
export const Loading = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', async () => {
          await new Promise(() => {}); // Never resolves
        }),
      ],
    },
  },
});

// Error state
export const Error = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});

// No hourly forecast data
export const NoHourlyData = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json({
            ...mockWeatherWithHourly,
            hourly_forecast: null,
          });
        }),
      ],
    },
  },
});

// Different day index
export const DayTwo = meta.story({
  args: {
    spotId: '1',
    dayIndex: 1,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherWithHourly);
        }),
      ],
    },
  },
});

// Interaction Tests

export const DisplaysHourlyData = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherWithHourly);
        }),
      ],
    },
  },
});

DisplaysHourlyData.test('displays hourly forecast data', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText('Prévisions Horaires')).toBeInTheDocument();
  });

  // Check table headers
  await expect(canvas.getByText('Heure')).toBeInTheDocument();
  await expect(canvas.getByText('Para-Index')).toBeInTheDocument();
  await expect(canvas.getByText('Temp')).toBeInTheDocument();
  await expect(canvas.getByText('Vent')).toBeInTheDocument();

  // Check first hour data
  await expect(canvas.getByText('10:00')).toBeInTheDocument();
  await expect(canvas.getByText('85/100')).toBeInTheDocument();
  await expect(canvas.getByText('18°C')).toBeInTheDocument();
  await expect(canvas.getByText('12 km/h')).toBeInTheDocument();
});

export const ShowsLoadingState = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

ShowsLoadingState.test('shows loading state', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText(/Chargement\.\.\./)).toBeInTheDocument();
  });
});

export const ShowsErrorState = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});

ShowsErrorState.test('shows error state', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText(/Données non disponibles/)).toBeInTheDocument();
  });
});

export const ShowsEmptyState = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json({
            ...mockWeatherWithHourly,
            hourly_forecast: [],
          });
        }),
      ],
    },
  },
});

ShowsEmptyState.test('shows empty state when no hourly data', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText(/Aucune donnée horaire disponible/)).toBeInTheDocument();
  });
});

export const OpensTooltipOnHover = meta.story({
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherWithHourly);
        }),
      ],
    },
  },
});

OpensTooltipOnHover.test('opens tooltip on hover', async ({ canvas }) => {
  const user = userEvent.setup();

  await waitFor(() => {
    expect(canvas.getByText('85/100')).toBeInTheDocument();
  });

  // Hover over para-index cell
  const paraIndexCell = canvas.getByText('85/100');
  await user.hover(paraIndexCell);

  // Check tooltip appears
  await waitFor(() => {
    expect(canvas.getByText(/Para-Index - 10:00/)).toBeInTheDocument();
  });
});
