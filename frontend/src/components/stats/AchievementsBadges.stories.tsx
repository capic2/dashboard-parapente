import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import AchievementsBadges from './AchievementsBadges';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Stats/AchievementsBadges',
  component: AchievementsBadges,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '1200px', padding: '20px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

export default meta;

const mockStats = {
  total_flights: 25,
  total_hours: 50,
  max_altitude_m: 2500,
  total_distance_km: 250,
};

const mockFlights = Array.from({ length: 25 }, (_, i) => ({
  id: `flight-${i}`,
  name: `Vol ${i + 1}`,
  flight_date: '2024-03-15',
  duration_minutes: 120,
}));

export const Default = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/stats*', () => {
          return HttpResponse.json(mockStats);
        }),
        http.get('*/api/flights*', () => {
          return HttpResponse.json({ flights: mockFlights });
        }),
      ],
    },
  },
});

export const Beginner = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/stats*', () => {
          return HttpResponse.json({ ...mockStats, total_flights: 3 });
        }),
        http.get('*/api/flights*', () => {
          return HttpResponse.json({ flights: mockFlights.slice(0, 3) });
        }),
      ],
    },
  },
});

export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/stats*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
