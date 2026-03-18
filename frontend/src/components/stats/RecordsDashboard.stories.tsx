import preview from '../../../.storybook/preview';
import { expect, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import RecordsDashboard from './RecordsDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Stats/RecordsDashboard',
  component: RecordsDashboard,
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

// Mock records data
const mockRecords = {
  longest_duration: {
    value: 125,
    flight_name: 'Vol XC Annecy',
    date: '2024-08-15',
    site_name: 'Annecy',
  },
  highest_altitude: {
    value: 2850,
    flight_name: 'Vol thermique',
    date: '2024-07-22',
    site_name: 'Chamonix',
  },
  longest_distance: {
    value: 45.3,
    flight_name: 'Cross country',
    date: '2024-06-10',
    site_name: 'Mont Poupet',
  },
  max_speed: {
    value: 62.4,
    flight_name: 'Speedflying',
    date: '2024-09-01',
    site_name: 'Talloires',
  },
};

const mockPartialRecords = {
  longest_duration: {
    value: 90,
    flight_name: 'Vol local',
    date: '2024-08-15',
    site_name: 'Annecy',
  },
  highest_altitude: {
    value: 1500,
    flight_name: 'Vol thermal',
    date: '2024-07-22',
  },
  longest_distance: null,
  max_speed: null,
};

// Default story - all records
export const AllRecords = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return HttpResponse.json(mockRecords);
        }),
      ],
    },
  },
});

// Partial records
export const PartialRecords = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return HttpResponse.json(mockPartialRecords);
        }),
      ],
    },
  },
});

// No records
export const NoRecords = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return HttpResponse.json({
            longest_duration: null,
            highest_altitude: null,
            longest_distance: null,
            max_speed: null,
          });
        }),
      ],
    },
  },
});

// Loading state
export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', async () => {
          await new Promise(() => {}); // Never resolves
        }),
      ],
    },
  },
});

// Error state
export const Error = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});

// Interaction Tests

export const DisplaysAllRecordCards = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return HttpResponse.json(mockRecords);
        }),
      ],
    },
  },
});

DisplaysAllRecordCards.test('displays all record cards', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText('🏆 Records Personnels')).toBeInTheDocument();
  });

  await expect(canvas.getByText('Vol le plus long')).toBeInTheDocument();
  await expect(canvas.getByText('Plus haute altitude')).toBeInTheDocument();
  await expect(canvas.getByText('Plus longue distance')).toBeInTheDocument();
  await expect(canvas.getByText('Vitesse maximale')).toBeInTheDocument();
});

export const DisplaysRecordValues = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return HttpResponse.json(mockRecords);
        }),
      ],
    },
  },
});

DisplaysRecordValues.test('displays record values correctly', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText('125 min')).toBeInTheDocument();
  });

  await expect(canvas.getByText('2850 m')).toBeInTheDocument();
  await expect(canvas.getByText('45.30 km')).toBeInTheDocument();
  await expect(canvas.getByText('62.4 km/h')).toBeInTheDocument();
});

export const ShowsLoadingSkeletons = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

ShowsLoadingSkeletons.test('shows loading skeletons', async ({ canvasElement }) => {
  const skeletons = canvasElement.querySelectorAll('.animate-pulse');
  await expect(skeletons.length).toBeGreaterThan(0);
});

export const ShowsErrorMessage = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});

ShowsErrorMessage.test('shows error message on error', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText(/Erreur/)).toBeInTheDocument();
  });
});

export const ShowsNoDataForMissingRecords = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/records*', () => {
          return HttpResponse.json(mockPartialRecords);
        }),
      ],
    },
  },
});

ShowsNoDataForMissingRecords.test('shows no data message for missing records', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText('90 min')).toBeInTheDocument();
  });

  // Should show "Aucune donnée disponible" for missing records
  const noDataTexts = canvas.getAllByText('Aucune donnée disponible');
  await expect(noDataTexts.length).toBe(2); // For distance and speed
});
