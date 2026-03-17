import type { Meta } from '@storybook/react';
import { expect, within, waitFor, userEvent } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';
import Forecast7Day from './Forecast7Day';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
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
} satisfies Meta<typeof Forecast7Day>;

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
export const MixedConditions = {
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
};

// All good conditions
export const AllGoodConditions = {
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryAllGood);
        }),
      ],
    },
  },
};

// All bad conditions
export const AllBadConditions = {
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryAllBad);
        }),
      ],
    },
  },
};

// Second day selected
export const SecondDaySelected = {
  args: {
    spotId: '1',
    selectedDayIndex: 1,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
};

// No selection
export const NoSelection = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
};

// With callback
export const WithCallback = {
  args: {
    spotId: '1',
    selectedDayIndex: 0,
    onSelectDay: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
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
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', async () => {
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
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
};

// Empty days data
export const EmptyDays = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json({ days: [] });
        }),
      ],
    },
  },
};

// No days field
export const NoDaysField = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json({});
        }),
      ],
    },
  },
};

// Interaction Tests

export const DisplaysDailyData = {
  args: {
    spotId: '1',
    selectedDayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText('Prévisions 7 Jours')).toBeInTheDocument();
    });

    // Check first day (today)
    expect(canvasElement.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(canvasElement.getByText('85')).toBeInTheDocument();
    expect(canvasElement.getByText('15° - 25°')).toBeInTheDocument();
    expect(canvasElement.getByText(/12 km\/h/)).toBeInTheDocument();

    // Check second day (tomorrow)
    expect(canvasElement.getByText('Demain')).toBeInTheDocument();
    expect(canvasElement.getByText('90')).toBeInTheDocument();
  },
};

export const ShowsLoadingState = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', async () => {
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
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText(/Données non disponibles/)).toBeInTheDocument();
    });
  },
};

export const HighlightsSelectedDay = {
  args: {
    spotId: '1',
    selectedDayIndex: 1,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText('Demain')).toBeInTheDocument();
    });

    // Find the "Demain" button and check it has selected styles
    const tomorrowButton = canvasElement.getByText('Demain').closest('button');
    expect(tomorrowButton).toHaveClass('border-sky-600');
    expect(tomorrowButton).toHaveClass('bg-sky-50');
  },
};

export const CallsOnSelectDayCallback = {
  args: {
    spotId: '1',
    selectedDayIndex: 0,
    onSelectDay: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/weather/daily-summary/:spotId', () => {
          return HttpResponse.json(mockDailySummaryGood);
        }),
      ],
    },
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(canvasElement.getByText('Demain')).toBeInTheDocument();
    });

    // Click on tomorrow button
    const tomorrowButton = canvasElement.getByText('Demain');
    await user.click(tomorrowButton);

    // Check callback was called with index 1
    expect(args.onSelectDay).toHaveBeenCalledWith(1);
  },
};
