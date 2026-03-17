import preview from '../../../.storybook/preview';
import { expect, waitFor, userEvent } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';
import Forecast7Day from './Forecast7Day';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Weather/Forecast7Day',
  component: Forecast7Day,
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

// Mock daily summary data
const mockDailySummaryGood = {
  days: [
    {
      date: new Date().toISOString().split('T')[0],
      para_index: 85,
      verdict: 'bon',
      temp_min: 15,
      temp_max: 25,
      wind_avg: 12,
    },
    {
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      para_index: 90,
      verdict: 'bon',
      temp_min: 16,
      temp_max: 26,
      wind_avg: 10,
    },
    {
      date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      para_index: 75,
      verdict: 'moyen',
      temp_min: 14,
      temp_max: 22,
      wind_avg: 18,
    },
    {
      date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      para_index: 50,
      verdict: 'limite',
      temp_min: 12,
      temp_max: 20,
      wind_avg: 25,
    },
    {
      date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      para_index: 30,
      verdict: 'mauvais',
      temp_min: 10,
      temp_max: 18,
      wind_avg: 35,
    },
    {
      date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      para_index: 65,
      verdict: 'moyen',
      temp_min: 13,
      temp_max: 21,
      wind_avg: 20,
    },
    {
      date: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
      para_index: 80,
      verdict: 'bon',
      temp_min: 15,
      temp_max: 24,
      wind_avg: 14,
    },
  ],
};

const mockDailySummaryAllGood = {
  days: [
    {
      date: new Date().toISOString().split('T')[0],
      para_index: 85,
      verdict: 'bon',
      temp_min: 18,
      temp_max: 28,
      wind_avg: 12,
    },
    {
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      para_index: 90,
      verdict: 'bon',
      temp_min: 19,
      temp_max: 29,
      wind_avg: 10,
    },
    {
      date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      para_index: 88,
      verdict: 'bon',
      temp_min: 18,
      temp_max: 27,
      wind_avg: 11,
    },
  ],
};

const mockDailySummaryAllBad = {
  days: [
    {
      date: new Date().toISOString().split('T')[0],
      para_index: 25,
      verdict: 'mauvais',
      temp_min: 8,
      temp_max: 15,
      wind_avg: 40,
    },
    {
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      para_index: 30,
      verdict: 'mauvais',
      temp_min: 9,
      temp_max: 16,
      wind_avg: 38,
    },
    {
      date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      para_index: 20,
      verdict: 'mauvais',
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
          return HttpResponse.json(mockDailySummaryAllGood);
        }),
      ],
    },
  },
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
          return HttpResponse.json(mockDailySummaryAllBad);
        }),
      ],
    },
  },
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', async () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
          return HttpResponse.json({});
        }),
      ],
    },
  },
});

// Interaction Tests

export const DisplaysDailyData = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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

export const ShowsLoadingState = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/daily-summary/:spotId*', async () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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

export const HighlightsSelectedDay = meta.story({
  args: {
    spotId: '1',
    selectedDayIndex: 1,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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
        http.get('*/api/weather/daily-summary/:spotId*', () => {
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
