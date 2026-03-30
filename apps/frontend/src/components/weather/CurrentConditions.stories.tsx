import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../../.storybook/preview';
import CurrentConditions from './CurrentConditions';
import { expect } from 'storybook/test';

const meta = preview.meta({
  title: 'Components/Weather/CurrentConditions',
  component: CurrentConditions,
  decorators: [
    (Story) => {
      // Create a new QueryClient for each story to avoid cache conflicts
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0, // Disable cache
            staleTime: 0, // Always consider data stale
          },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '400px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});



// Mock data - matches BackendWeatherResponseSchema
// Current hour is used for CurrentConditions display
const currentHour = 10;

const mockWeatherGood = {
  site_id: '1',
  site_name: 'Annecy',
  day_index: 0,
  days: 1,
  para_index: 85,
  verdict: 'bon',
  emoji: '🟢',
  explanation: 'Conditions favorables',
  consensus: [
    {
      hour: currentHour,
      temperature: 22,
      wind_speed: 12,
      wind_gust: 18,
      wind_direction: 315, // NW
      precipitation: 0,
      cloud_cover: 10,
      para_index: 85,
      verdict: 'bon',
    },
  ],
};

const mockWeatherModerate = {
  site_id: '1',
  site_name: 'Annecy',
  day_index: 0,
  days: 1,
  para_index: 65,
  verdict: 'moyen',
  emoji: '🟡',
  explanation: 'Conditions moyennes',
  consensus: [
    {
      hour: currentHour,
      temperature: 18,
      wind_speed: 20,
      wind_gust: 28,
      wind_direction: 45, // NE
      precipitation: 0,
      cloud_cover: 50,
      para_index: 65,
      verdict: 'moyen',
    },
  ],
};

const mockWeatherLimite = {
  site_id: '1',
  site_name: 'Annecy',
  day_index: 0,
  days: 1,
  para_index: 45,
  verdict: 'limite',
  emoji: '🟠',
  explanation: 'Conditions limites',
  consensus: [
    {
      hour: currentHour,
      temperature: 15,
      wind_speed: 28,
      wind_gust: 35,
      wind_direction: 180, // S
      precipitation: 0,
      cloud_cover: 75,
      para_index: 45,
      verdict: 'limite',
    },
  ],
};

const mockWeatherBad = {
  site_id: '1',
  site_name: 'Annecy',
  day_index: 0,
  days: 1,
  para_index: 25,
  verdict: 'mauvais',
  emoji: '🔴',
  explanation: 'Conditions défavorables',
  consensus: [
    {
      hour: currentHour,
      temperature: 10,
      wind_speed: 35,
      wind_gust: 45,
      wind_direction: 90, // E
      precipitation: 5,
      cloud_cover: 90,
      para_index: 25,
      verdict: 'mauvais',
    },
  ],
};

const mockWeatherNoGusts = {
  site_id: '1',
  site_name: 'Annecy',
  day_index: 0,
  days: 1,
  para_index: 90,
  verdict: 'bon',
  emoji: '🟢',
  explanation: 'Conditions parfaites',
  consensus: [
    {
      hour: currentHour,
      temperature: 24,
      wind_speed: 8,
      wind_gust: null,
      wind_direction: 270, // W
      precipitation: 0,
      cloud_cover: 5,
      para_index: 90,
      verdict: 'bon',
    },
  ],
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
        http.get('*/api/weather/:spotId', () => {
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
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherModerate);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

ModerateConditions.test(
  'displays moderate conditions correctly',
  async ({ canvas }) => {
    await canvas.findByText(/65\/100/);

    await expect(canvas.getByText(/MOYEN/)).toBeInTheDocument();
    await expect(canvas.getByText('18°C')).toBeInTheDocument();
    await expect(canvas.getByText(/20 km\/h NE/)).toBeInTheDocument();
    await expect(canvas.getByText(/28 km\/h/)).toBeInTheDocument();
    await expect(canvas.getByText(/50% nuages, Sec/)).toBeInTheDocument();
  }
);

// Limite conditions
export const LimiteConditions = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherLimite);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

LimiteConditions.test(
  'displays limite conditions correctly',
  async ({ canvas }) => {
    await canvas.findByText(/45\/100/);

    await expect(canvas.getByText(/LIMITE/)).toBeInTheDocument();
    await expect(canvas.getByText('15°C')).toBeInTheDocument();
    await expect(canvas.getByText(/28 km\/h S/)).toBeInTheDocument();
    await expect(canvas.getByText(/35 km\/h/)).toBeInTheDocument();
    await expect(canvas.getByText(/75% nuages, Sec/)).toBeInTheDocument();
  }
);

// Bad conditions
export const BadConditions = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherBad);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json(mockSite);
        }),
      ],
    },
  },
});

BadConditions.test('displays bad conditions correctly', async ({ canvas }) => {
  await canvas.findByText(/25\/100/);

  await expect(canvas.getByText(/MAUVAIS/)).toBeInTheDocument();
  await expect(canvas.getByText('10°C')).toBeInTheDocument();
  await expect(canvas.getByText(/35 km\/h E/)).toBeInTheDocument();
  await expect(canvas.getByText(/45 km\/h/)).toBeInTheDocument();
  await expect(
    canvas.getByText(/90% nuages, 5\.0mm pluie/)
  ).toBeInTheDocument();
});

// No gusts data
export const NoGustsData = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
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
        http.get('*/api/weather/:spotId', () => {
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
        http.get('*/api/weather/:spotId', () => {
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

/*
export const DisplaysWeatherData = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/:spotId', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
        http.get('*!/api/spots/:id', () => {
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
        http.get('*!/api/spots/:id', () => {
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
        http.get('*!/api/weather/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get('*!/api/spots/:id', () => {
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
*/
