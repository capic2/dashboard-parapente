import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import HourlyForecast from './HourlyForecast';
import { expect } from 'storybook/test';

const meta = preview.meta({
  title: 'Components/Weather/HourlyForecast',
  component: HourlyForecast,
  decorators: [
    (Story) => {
      // Create a new QueryClient for each story to avoid cache conflicts
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0, // Disable cache (React Query v5+)
            staleTime: 0, // Always consider data stale
          },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '1200px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

// Mock hourly forecast data
const mockHourlyForecastGood = [
  {
    hour: '10:00',
    para_index: 85,
    verdict: 'bon',
    temperature: 22,
    temp: 22,
    wind: 10,
    wind_speed: 10,
    wind_gust: 15,
    direction: 'NW',
    precipitation: 0,
    cape: 800,
    thermal_strength: 'fort',
    sources: {
      'open-meteo': {
        temperature: 22.2,
        wind_speed: 10.1,
        wind_gust: 14.8,
        wind_direction: 315,
        precipitation: 0,
        cloud_cover: 10,
      },
      weatherapi: {
        temperature: 21.8,
        wind_speed: 9.9,
        wind_gust: 15.2,
        wind_direction: 310,
        precipitation: 0,
        cloud_cover: 12,
      },
    },
  },
  {
    hour: '11:00',
    para_index: 92,
    verdict: 'bon',
    temperature: 24,
    temp: 24,
    wind: 11,
    wind_speed: 11,
    wind_gust: 16,
    direction: 'NW',
    precipitation: 0,
    cape: 1000,
    thermal_strength: 'fort',
    sources: {
      'open-meteo': {
        temperature: 24.1,
        wind_speed: 11.2,
        wind_gust: 16.1,
        wind_direction: 320,
        precipitation: 0,
        cloud_cover: 8,
      },
      weatherapi: {
        temperature: 23.9,
        wind_speed: 10.8,
        wind_gust: 15.9,
        wind_direction: 315,
        precipitation: 0,
        cloud_cover: 10,
      },
    },
  },
  {
    hour: '12:00',
    para_index: 90,
    verdict: 'bon',
    temperature: 25,
    temp: 25,
    wind: 12,
    wind_speed: 12,
    wind_gust: 17,
    direction: 'W',
    precipitation: 0,
    cape: 1200,
    thermal_strength: 'fort',
    sources: {
      'open-meteo': {
        temperature: 25.3,
        wind_speed: 12.1,
        wind_gust: 17.2,
        wind_direction: 280,
        precipitation: 0,
        cloud_cover: 5,
      },
      weatherapi: {
        temperature: 24.7,
        wind_speed: 11.9,
        wind_gust: 16.8,
        wind_direction: 275,
        precipitation: 0,
        cloud_cover: 8,
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
    thermal_strength: 'faible',
    sources: {
      'open-meteo': {
        temperature: 16.1,
        wind_speed: 17.8,
        wind_gust: 25.5,
        wind_direction: 45,
        precipitation: 0.1,
        cloud_cover: 45,
      },
      weatherapi: {
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
    thermal_strength: 'faible',
    sources: {
      'open-meteo': {
        temperature: 15.2,
        wind_speed: 24.8,
        wind_gust: 31.5,
        wind_direction: 90,
        precipitation: 1.2,
        cloud_cover: 75,
      },
      weatherapi: {
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
    thermal_strength: 'faible',
    sources: {
      'open-meteo': {
        temperature: 14.1,
        wind_speed: 31.8,
        wind_gust: 41.5,
        wind_direction: 88,
        precipitation: 3.2,
        cloud_cover: 95,
      },
      weatherapi: {
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

const mockBackendWeatherGood = {
  site_id: '1',
  site_name: 'Annecy',
  day_index: 0,
  days: 1,
  para_index: 85,
  verdict: 'bon',
  emoji: '🟢',
  explanation: 'Conditions excellentes pour le vol',
  slots_summary: 'Vol possible toute la journée',
  sunrise: '06:30',
  sunset: '20:00',
  metrics: {
    avg_temp_c: 20,
    avg_wind_kmh: 14,
    max_gust_kmh: 22,
    total_rain_mm: 0,
  },
  consensus: mockHourlyForecastGood.map((hour) => ({
    hour: parseInt(hour.hour.split(':')[0]),
    temperature: hour.temp,
    wind_speed: hour.wind_speed,
    wind_gust: hour.wind_gust,
    wind_direction:
      hour.direction === 'NW' ? 315 : hour.direction === 'W' ? 270 : 315,
    precipitation: hour.precipitation,
    cloud_cover: hour.sources['open-meteo'].cloud_cover,
    cape: hour.cape,
    para_index: hour.para_index,
    verdict: hour.verdict,
    thermal_strength: hour.thermal_strength,
    sources: hour.sources,
  })),
};

const mockBackendWeatherMixed = {
  site_id: '1',
  site_name: 'Annecy',
  day_index: 0,
  days: 1,
  para_index: 50,
  verdict: 'moyen',
  emoji: '🟡',
  explanation: 'Conditions variables',
  slots_summary: 'Vol possible avec prudence',
  sunrise: '06:30',
  sunset: '20:00',
  metrics: {
    avg_temp_c: 15,
    avg_wind_kmh: 23,
    max_gust_kmh: 35,
    total_rain_mm: 1.5,
  },
  consensus: mockHourlyForecastMixed.map((hour) => ({
    hour: parseInt(hour.hour.split(':')[0]),
    temperature: hour.temp,
    wind_speed: hour.wind_speed,
    wind_gust: hour.wind_gust,
    wind_direction:
      hour.direction === 'NE' ? 45 : hour.direction === 'E' ? 90 : 90,
    precipitation: hour.precipitation,
    cloud_cover: hour.sources['open-meteo'].cloud_cover,
    cape: hour.cape,
    para_index: hour.para_index,
    verdict: hour.verdict,
    thermal_strength: hour.thermal_strength,
    sources: hour.sources,
  })),
};

// Default story - Good conditions
export const GoodConditions = meta.story({
  name: 'Good Conditions',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json(mockBackendWeatherGood);
        }),
      ],
    },
  },
});
GoodConditions.test('it renders the correct values', async ({ canvas }) => {
  const { getByText, getAllByText } = canvas;

  // Wait for data to load - wait for a specific value that only appears when data is loaded
  await canvas.findByText('85/100');

  // Verify table headers are present (headers now include icons and units)
  await expect(getByText('Heure')).toBeInTheDocument();
  await expect(getByText('Para-Index')).toBeInTheDocument();
  await expect(getByText('Temp (°C)')).toBeInTheDocument();
  await expect(getByText('Vent (km/h)')).toBeInTheDocument();
  await expect(getByText('Rafales (km/h)')).toBeInTheDocument();
  await expect(getByText('Direction')).toBeInTheDocument();
  await expect(getByText('Précip. (mm)')).toBeInTheDocument();
  await expect(getByText('Nuages (%)')).toBeInTheDocument();
  await expect(getByText('CAPE (J/kg)')).toBeInTheDocument();
  await expect(getByText('Thermiques')).toBeInTheDocument();
  await expect(getByText('Volabilité')).toBeInTheDocument();

  // Verify hours are displayed
  await expect(getByText('10:00')).toBeInTheDocument();
  await expect(getByText('11:00')).toBeInTheDocument();
  await expect(getByText('12:00')).toBeInTheDocument();

  // Verify para_index values (unique values)
  await expect(getByText('85/100')).toBeInTheDocument(); // 10:00
  await expect(getByText('92/100')).toBeInTheDocument(); // 11:00
  await expect(getByText('90/100')).toBeInTheDocument(); // 12:00

  // Verify temperatures (units now in headers, cells show raw values)
  await expect(getByText('22')).toBeInTheDocument(); // 10:00
  await expect(getByText('24')).toBeInTheDocument(); // 11:00
  await expect(getByText('25')).toBeInTheDocument(); // 12:00

  // Verify wind speeds (units now in headers, some values may appear in multiple columns)
  await expect(getAllByText('10').length).toBeGreaterThanOrEqual(1); // 10:00 (also cloud cover)
  await expect(getAllByText('11').length).toBeGreaterThanOrEqual(1); // 11:00
  await expect(getAllByText('12').length).toBeGreaterThanOrEqual(1); // 12:00

  // Verify wind gusts (units now in headers)
  await expect(getByText('15.0')).toBeInTheDocument(); // 10:00
  await expect(getByText('16.0')).toBeInTheDocument(); // 11:00
  await expect(getByText('17.0')).toBeInTheDocument(); // 12:00

  // Verify wind direction arrows are rendered (SVG elements with aria-label)
  const directionArrows = canvas.getAllByLabelText(/Vent \d+°/);
  await expect(directionArrows.length).toBeGreaterThanOrEqual(3);

  // Verify cloud cover values (units now in headers)
  await expect(getAllByText('10').length).toBeGreaterThanOrEqual(1); // 10:00 (also wind speed)
  await expect(getAllByText('8').length).toBeGreaterThanOrEqual(1); // 11:00
  await expect(getAllByText('5').length).toBeGreaterThanOrEqual(1); // 12:00

  // Verify CAPE values (unique values)
  await expect(getByText('800')).toBeInTheDocument(); // 10:00
  await expect(getByText('1000')).toBeInTheDocument(); // 11:00
  await expect(getByText('1200')).toBeInTheDocument(); // 12:00

  // Verify thermal strength
  await expect(getAllByText('fort').length).toBeGreaterThanOrEqual(3); // All hours have "fort"

  // Verify all hours show "BON" verdict (since all have verdict: 'bon')
  const bonVerdicts = getAllByText(/BON/);
  await expect(bonVerdicts.length).toBeGreaterThanOrEqual(3); // At least one for each hour
});

// Mixed conditions (good, moderate, bad)
export const MixedConditions = meta.story({
  name: 'Mixed Conditions',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json(mockBackendWeatherMixed);
        }),
      ],
    },
  },
});

MixedConditions.test(
  'it renders mixed conditions correctly',
  async ({ canvas }) => {
    const { getByText, getAllByText } = canvas;

    // Wait for data to load
    await canvas.findByText('75/100');

    // Verify para_index values (different from good conditions)
    await expect(getByText('75/100')).toBeInTheDocument(); // 10:00 - moyen
    await expect(getByText('45/100')).toBeInTheDocument(); // 11:00 - limite
    await expect(getByText('30/100')).toBeInTheDocument(); // 12:00 - mauvais

    // Verify temperatures (units now in headers)
    await expect(getByText('16')).toBeInTheDocument(); // 10:00
    await expect(getByText('15')).toBeInTheDocument(); // 11:00
    await expect(getByText('14')).toBeInTheDocument(); // 12:00

    // Verify wind speeds (units now in headers)
    await expect(getByText('18')).toBeInTheDocument(); // 10:00
    await expect(getByText('25')).toBeInTheDocument(); // 11:00
    await expect(getByText('32')).toBeInTheDocument(); // 12:00

    // Verify different verdicts appear
    await expect(getAllByText(/MOYEN/).length).toBeGreaterThanOrEqual(1);
    await expect(getAllByText(/LIMITE/).length).toBeGreaterThanOrEqual(1);
    await expect(getAllByText(/MAUVAIS/).length).toBeGreaterThanOrEqual(1);

    // Verify thermal strength is "Faible" for all (bad conditions)
    await expect(getAllByText('faible').length).toBeGreaterThanOrEqual(3);
  }
);

// Empty hourly forecast
export const EmptyForecast = meta.story({
  name: 'Empty Forecast',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json({
            ...mockBackendWeatherGood,
            consensus: [],
          });
        }),
      ],
    },
  },
});

// Loading state
export const Loading = meta.story({
  name: 'Loading',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', async () => {
          await new Promise(() => {}); // Never resolves
        }),
      ],
    },
  },
});

// Error state
export const Error = meta.story({
  name: 'Error',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});

// No hourly forecast data
export const NoHourlyData = meta.story({
  name: 'No Hourly Data',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json({
            ...mockBackendWeatherGood,
            consensus: null,
          });
        }),
      ],
    },
  },
});

// Different day index
export const DayTwo = meta.story({
  name: 'Day Two',
  args: {
    spotId: '1',
    dayIndex: 1,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json(mockBackendWeatherGood);
        }),
      ],
    },
  },
});

// Interaction Tests
/*

export const DisplaysHourlyData = meta.story({
  name: 'Displays Hourly Data',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/:spotId', () => {
          return HttpResponse.json(mockBackendWeatherGood);
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
  name: 'Shows Loading State',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/:spotId', async () => {
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
  name: 'Shows Error State',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/:spotId', () => {
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
  name: 'Shows Empty State',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/:spotId', () => {
          return HttpResponse.json({
            ...mockBackendWeatherGood,
            consensus: [],
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
  name: 'Opens Tooltip On Hover',
  args: {
    spotId: '1',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/:spotId', () => {
          return HttpResponse.json(mockBackendWeatherGood);
        }),
      ],
    },
  },
});

OpensTooltipOnHover.test('opens tooltip on hover', async ({ canvas, userEvent }) => {
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
*/
