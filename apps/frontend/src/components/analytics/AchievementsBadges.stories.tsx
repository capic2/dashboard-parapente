import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import AchievementsBadges from './AchievementsBadges';

const meta = preview.meta({
  title: 'Components/Stats/AchievementsBadges',
  component: AchievementsBadges,
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
          <div style={{ maxWidth: '1200px', padding: '20px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

export const baseStats = {
  total_flights: 0,
  total_hours: 0,
  total_duration_minutes: 0,
  total_distance_km: 0,
  total_elevation_gain_m: 0,
  avg_duration_minutes: 0,
  avg_distance_km: 0,
  max_altitude_m: 0,
  favorite_spot: null,
  favorite_site: null,
  last_flight_date: null,
};

function statsHandlers(stats: Partial<typeof baseStats>) {
  return [
    http.get('*/api/flights/stats', () =>
      HttpResponse.json({ ...baseStats, ...stats })
    ),
    http.get('*/api/flights', () =>
      HttpResponse.json({
        flights: Array.from({ length: stats.total_flights ?? 0 }, (_, i) => ({
          id: `flight-${i}`,
          name: `Vol ${i + 1}`,
          flight_date: '2024-03-15',
          duration_minutes: 120,
        })),
      })
    ),
  ];
}

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/stats', async () => {
          console.log('aaaa')
          await new Promise(() => {});
        }),
      ],
    },
  },
});

export const noBadgesStats = {};

export const partialProgressStats = {
  total_flights: 25,
  total_hours: 50,
  max_altitude_m: 2500,
  total_distance_km: 250,
};

export const allUnlockedStats = {
  total_flights: 100,
  total_hours: 100,
  max_altitude_m: 3000,
  total_distance_km: 500,
};

export const NoBadges = meta.story({
  name: 'No Badges',
  parameters: {
    msw: {
      handlers: statsHandlers(noBadgesStats),
    },
  },
});

export const PartialProgress = meta.story({
  name: 'Partial Progress',
  parameters: {
    msw: {
      handlers: statsHandlers(partialProgressStats),
    },
  },
});

export const AllUnlocked = meta.story({
  name: 'All Unlocked',
  parameters: {
    msw: {
      handlers: statsHandlers(allUnlockedStats),
    },
  },
});
