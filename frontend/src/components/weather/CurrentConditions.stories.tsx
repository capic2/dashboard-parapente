import { expect, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../../.storybook/preview';
import CurrentConditions from './CurrentConditions';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Weather/CurrentConditions',
  component: CurrentConditions,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '400px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

export default meta;

// Mock data
const mockWeatherGood = {
  id: 1,
  spot_id: 1,
  spot_name: 'Annecy',
  para_index: 85,
  verdict: 'bon',
  temperature: 22,
  wind_speed: 12,
  wind_direction: 'NW',
  wind_gusts: 18,
  conditions: 'Ensoleillé',
  forecast_time: '2024-03-15T14:30:00Z',
};

const mockWeatherModerate = {
  id: 2,
  spot_id: 1,
  spot_name: 'Annecy',
  para_index: 65,
  verdict: 'moyen',
  temperature: 18,
  wind_speed: 20,
  wind_direction: 'NE',
  wind_gusts: 28,
  conditions: 'Nuageux',
  forecast_time: '2024-03-15T14:30:00Z',
};

const mockWeatherLimite = {
  id: 3,
  spot_id: 1,
  spot_name: 'Annecy',
  para_index: 45,
  verdict: 'limite',
  temperature: 15,
  wind_speed: 28,
  wind_direction: 'S',
  wind_gusts: 35,
  conditions: 'Très nuageux',
  forecast_time: '2024-03-15T14:30:00Z',
};

const mockWeatherBad = {
  id: 4,
  spot_id: 1,
  spot_name: 'Annecy',
  para_index: 25,
  verdict: 'mauvais',
  temperature: 10,
  wind_speed: 35,
  wind_direction: 'E',
  wind_gusts: 45,
  conditions: 'Orageux',
  forecast_time: '2024-03-15T14:30:00Z',
};

const mockWeatherNoGusts = {
  id: 5,
  spot_id: 1,
  spot_name: 'Annecy',
  para_index: 90,
  verdict: 'bon',
  temperature: 24,
  wind_speed: 8,
  wind_direction: 'W',
  wind_gusts: null,
  conditions: 'Parfait',
  forecast_time: '2024-03-15T14:30:00Z',
};

const mockSite = {
  id: '1',
  name: 'Annecy',
  orientation: 'NW',
  latitude: 45.9,
  longitude: 6.1,
  country: 'FR',
  is_active: true,
};

// Default story - Good conditions
export const GoodConditions = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

// Moderate conditions
export const ModerateConditions = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherModerate);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

// Limite conditions
export const LimiteConditions = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherLimite);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

// Bad conditions
export const BadConditions = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherBad);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

// No gusts data
export const NoGustsData = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherNoGusts);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

// Loading state
export const Loading = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', async () => {
          await new Promise(() => {}); // Never resolves
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

// Error state
export const Error = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

// Site without orientation (no WindIndicator)
export const NoSiteOrientation = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json({ ...mockSite, orientation: null });
        }),
      ],
    },
  },
});

// Interaction Tests

export const DisplaysWeatherData = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

DisplaysWeatherData.test('should display weather data correctly', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText(/85\/100/)).toBeInTheDocument();
  });

  await expect(canvas.getByText(/BON/)).toBeInTheDocument();
  await expect(canvas.getByText(/22°C/)).toBeInTheDocument();
  await expect(canvas.getByText(/12 km\/h NW/)).toBeInTheDocument();
  await expect(canvas.getByText(/18 km\/h/)).toBeInTheDocument();
  await expect(canvas.getByText(/Ensoleillé/)).toBeInTheDocument();
});

export const ShowsLoadingState = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

ShowsLoadingState.test('should show loading state', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText(/Chargement\.\.\./)).toBeInTheDocument();
  });
});

export const ShowsErrorState = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

ShowsErrorState.test('should show error state', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText(/Impossible de charger les données météo/)).toBeInTheDocument();
  });
});
