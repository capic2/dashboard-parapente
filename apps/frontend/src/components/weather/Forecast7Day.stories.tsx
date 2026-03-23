import preview from '../../../.storybook/preview';
import { expect, fn, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import Forecast7Day from './Forecast7Day';

const meta = preview.meta({
  title: 'Components/Weather/Forecast7Day',
  component: Forecast7Day,
  decorators: [
    (Story) => {
      // Create a new QueryClient for each story to avoid cache conflicts
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { 
            retry: false,
            gcTime: 0,  // Disable cache
            staleTime: 0,  // Always consider data stale
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

export default meta;

// Mock daily summary data
const mockDailySummaryGood = {
  site_id: '1',
  site_name: 'Annecy',
  days: [
    {
      day_index: 0,
      date: '2025-06-15',
      para_index: 85,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 15,
      temp_max: 25,
      wind_avg: 12,
    },
    {
      day_index: 1,
      date: '2025-06-16',
      para_index: 90,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 16,
      temp_max: 26,
      wind_avg: 10,
    },
    {
      day_index: 2,
      date: '2025-06-17',
      para_index: 75,
      verdict: 'moyen',
      emoji: '🟡',
      temp_min: 14,
      temp_max: 22,
      wind_avg: 18,
    },
    {
      day_index: 3,
      date: '2025-06-18',
      para_index: 50,
      verdict: 'limite',
      emoji: '🟠',
      temp_min: 12,
      temp_max: 20,
      wind_avg: 25,
    },
    {
      day_index: 4,
      date: '2025-06-19',
      para_index: 30,
      verdict: 'mauvais',
      emoji: '🔴',
      temp_min: 10,
      temp_max: 18,
      wind_avg: 35,
    },
    {
      day_index: 5,
      date: '2025-06-20',
      para_index: 65,
      verdict: 'moyen',
      emoji: '🟡',
      temp_min: 13,
      temp_max: 21,
      wind_avg: 20,
    },
    {
      day_index: 6,
      date: '2025-06-21',
      para_index: 80,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 15,
      temp_max: 24,
      wind_avg: 14,
    },
  ],
};

const mockDailySummaryAllGood = {
  site_id: '1',
  site_name: 'Annecy',
  days: [
    {
      day_index: 0,
      date: '2025-06-15',
      para_index: 85,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 18,
      temp_max: 28,
      wind_avg: 12,
    },
    {
      day_index: 1,
      date: '2025-06-16',
      para_index: 90,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 19,
      temp_max: 29,
      wind_avg: 10,
    },
    {
      day_index: 2,
      date: '2025-06-17',
      para_index: 88,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 18,
      temp_max: 27,
      wind_avg: 11,
    },
  ],
};

const mockDailySummaryAllBad = {
  site_id: '1',
  site_name: 'Annecy',
  days: [
    {
      day_index: 0,
      date: '2025-06-15',
      para_index: 25,
      verdict: 'mauvais',
      emoji: '🔴',
      temp_min: 8,
      temp_max: 15,
      wind_avg: 40,
    },
    {
      day_index: 1,
      date: '2025-06-16',
      para_index: 30,
      verdict: 'mauvais',
      emoji: '🔴',
      temp_min: 9,
      temp_max: 16,
      wind_avg: 38,
    },
    {
      day_index: 2,
      date: '2025-06-17',
      para_index: 20,
      verdict: 'mauvais',
      emoji: '🔴',
      temp_min: 7,
      temp_max: 14,
      wind_avg: 42,
    },
  ],
};

// Default story - Mixed conditions
export const MixedConditions = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
});

MixedConditions.test('displays mixed conditions correctly', async ({ canvas }) => {
  // Wait for data to load
  await canvas.findByText(/85/);
  
  // Verify para_index values for all 7 days (these are unique identifiers)
  await expect(canvas.getByText('85')).toBeInTheDocument();
  await expect(canvas.getByText('90')).toBeInTheDocument();
  await expect(canvas.getByText('75')).toBeInTheDocument();
  await expect(canvas.getByText('50')).toBeInTheDocument();
  await expect(canvas.getByText('30')).toBeInTheDocument();
  await expect(canvas.getByText('65')).toBeInTheDocument();
  await expect(canvas.getByText('80')).toBeInTheDocument();
  
  // Verify temperature range for first day
  await expect(canvas.getByText('15° - 25°')).toBeInTheDocument();
  
  // Verify wind speed for first day
  await expect(canvas.getByText(/12 km\/h/)).toBeInTheDocument();
  
  // Verify mixed verdicts exist (multiple instances expected)
  const bonElements = canvas.getAllByText('bon');
  const moyenElements = canvas.getAllByText('moyen');
  const limiteElements = canvas.getAllByText('limite');
  const mauvaisElements = canvas.getAllByText('mauvais');
  
  await expect(bonElements.length).toBeGreaterThan(0);
  await expect(moyenElements.length).toBeGreaterThan(0);
  await expect(limiteElements.length).toBeGreaterThan(0);
  await expect(mauvaisElements.length).toBeGreaterThan(0);
});

// All good conditions
export const AllGoodConditions = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json(mockDailySummaryAllGood);
        }),
      ],
    },
  },
});

AllGoodConditions.test('displays all good conditions correctly', async ({ canvas }) => {
  // Wait for data to load
  await canvas.findByText(/85/);
  
  // Verify all days show "bon" verdict (should appear 3 times)
  const bonElements = canvas.getAllByText('bon');
  await expect(bonElements).toHaveLength(3);
  
  // Verify para_index values for all 3 days
  await expect(canvas.getByText('85')).toBeInTheDocument();
  await expect(canvas.getByText('90')).toBeInTheDocument();
  await expect(canvas.getByText('88')).toBeInTheDocument();
  
  // Verify temperature range for first day
  await expect(canvas.getByText('18° - 28°')).toBeInTheDocument();
  
  // Verify wind speed for first day
  await expect(canvas.getByText(/12 km\/h/)).toBeInTheDocument();
});

// All bad conditions
export const AllBadConditions = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json(mockDailySummaryAllBad);
        }),
      ],
    },
  },
});

AllBadConditions.test('displays all bad conditions correctly', async ({ canvas }) => {
  // Wait for data to load
  await canvas.findByText(/25/);
  
  // Verify all days show "mauvais" verdict (should appear 3 times)
  const mauvaisElements = canvas.getAllByText('mauvais');
  await expect(mauvaisElements).toHaveLength(3);
  
  // Verify para_index values for all 3 days
  await expect(canvas.getByText('25')).toBeInTheDocument();
  await expect(canvas.getByText('30')).toBeInTheDocument();
  await expect(canvas.getByText('20')).toBeInTheDocument();
  
  // Verify temperature range for first day
  await expect(canvas.getByText('8° - 15°')).toBeInTheDocument();
  
  // Verify wind speed for first day
  await expect(canvas.getByText(/40 km\/h/)).toBeInTheDocument();
});

// Second day selected
export const SecondDaySelected = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 1,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
});

// No selection
export const NoSelection = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
});

// With callback
export const WithCallback = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 0,
    onSelectDay: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json(mockDailySummaryGood);
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
        http.get('*/api/weather/daily-summary/:spotId', async () => {
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
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});

// Empty days data
export const EmptyDays = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json({ days: [] });
        }),
      ],
    },
  },
});

// No days field
export const NoDaysField = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
          return HttpResponse.json({});
        }),
      ],
    },
  },
});

// Interaction Tests

/*
export const DisplaysDailyData = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
});

DisplaysDailyData.test('displays daily forecast data', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText('Prévisions 7 Jours')).toBeInTheDocument();
  });

  // Check first day (today)
  await expect(canvas.getByText("Aujourd'hui")).toBeInTheDocument();
  await expect(canvas.getByText('85')).toBeInTheDocument();
  await expect(canvas.getByText('15° - 25°')).toBeInTheDocument();
  await expect(canvas.getByText(/12 km\/h/)).toBeInTheDocument();

  // Check second day (tomorrow)
  await expect(canvas.getByText('Demain')).toBeInTheDocument();
  await expect(canvas.getByText('90')).toBeInTheDocument();
});
*/

export const ShowsLoadingState = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/daily-summary/:spotId', async () => {
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
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId/daily-summary', () => {
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

/*
export const HighlightsSelectedDay = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 1,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
});

HighlightsSelectedDay.test('highlights selected day', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText('Demain')).toBeInTheDocument();
  });

  // Find the "Demain" button and check it has selected styles
  const tomorrowButton = canvas.getByText('Demain').closest('button');
  await expect(tomorrowButton).toHaveClass('border-sky-600');
  await expect(tomorrowButton).toHaveClass('bg-sky-50');
});

export const CallsOnSelectDayCallback = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 0,
    onSelectDay: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*!/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
});

CallsOnSelectDayCallback.test('calls onSelectDay callback', async ({ args, canvas }) => {
  const user = userEvent.setup();

  await waitFor(() => {
    expect(canvas.getByText('Demain')).toBeInTheDocument();
  });

  // Click on tomorrow button
  const tomorrowButton = canvas.getByText('Demain');
  await user.click(tomorrowButton);

  // Check callback was called with index 1
  await expect(args.onSelectDay).toHaveBeenCalledWith(1);
});
*/
