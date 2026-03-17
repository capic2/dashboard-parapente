import type { Meta } from '@storybook/react';
import { expect, within, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import CurrentConditions from './CurrentConditions';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
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
} satisfies Meta<typeof CurrentConditions>;

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
  id: 1,
  name: 'Annecy',
  orientation: ['NW', 'W'],
  latitude: 45.9,
  longitude: 6.1,
};

// Default story - Good conditions
export const GoodConditions = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
        http.get('http://localhost:5000/api/sites/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
};

// Moderate conditions
export const ModerateConditions = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherModerate);
        }),
        http.get('http://localhost:5000/api/sites/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
};

// Limite conditions
export const LimiteConditions = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherLimite);
        }),
        http.get('http://localhost:5000/api/sites/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
};

// Bad conditions
export const BadConditions = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherBad);
        }),
        http.get('http://localhost:5000/api/sites/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
};

// No gusts data
export const NoGustsData = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherNoGusts);
        }),
        http.get('http://localhost:5000/api/sites/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
};

// Loading state
export const Loading = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', async () => {
          await new Promise(() => {}); // Never resolves
        }),
      ],
    },
  },
};

// Error state
export const Error = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
};

// Site without orientation (no WindIndicator)
export const NoSiteOrientation = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
        http.get('http://localhost:5000/api/sites/:id', () => {
          return HttpResponse.json({ ...mockSite, orientation: null });
        }),
      ],
    },
  },
};

// Interaction Tests

export const DisplaysWeatherData = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
        http.get('http://localhost:5000/api/sites/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText(/85\/100/)).toBeInTheDocument();
    });

    expect(canvasElement.getByText(/BON/)).toBeInTheDocument();
    expect(canvasElement.getByText(/22°C/)).toBeInTheDocument();
    expect(canvasElement.getByText(/12 km\/h NW/)).toBeInTheDocument();
    expect(canvasElement.getByText(/18 km\/h/)).toBeInTheDocument();
    expect(canvasElement.getByText(/Ensoleillé/)).toBeInTheDocument();
  },
};

export const ShowsLoadingState = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText(/Chargement\.\.\./)).toBeInTheDocument();
    });
  },
};

export const ShowsErrorState = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText(/Impossible de charger les données météo/)).toBeInTheDocument();
    });
  },
};
