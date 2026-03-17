import type { Meta } from '@storybook/react';
import { expect, within, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import RecordsDashboard from './RecordsDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
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
} satisfies Meta<typeof RecordsDashboard>;

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
export const AllRecords = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
          return HttpResponse.json(mockRecords);
        }),
      ],
    },
  },
};

// Partial records
export const PartialRecords = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
          return HttpResponse.json(mockPartialRecords);
        }),
      ],
    },
  },
};

// No records
export const NoRecords = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
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
};

// Loading state
export const Loading = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', async () => {
          await new Promise(() => {}); // Never resolves
        }),
      ],
    },
  },
};

// Error state
export const Error = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
};

// Interaction Tests

export const DisplaysAllRecordCards = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
          return HttpResponse.json(mockRecords);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText('🏆 Records Personnels')).toBeInTheDocument();
    });

    expect(canvasElement.getByText('Vol le plus long')).toBeInTheDocument();
    expect(canvasElement.getByText('Plus haute altitude')).toBeInTheDocument();
    expect(canvasElement.getByText('Plus longue distance')).toBeInTheDocument();
    expect(canvasElement.getByText('Vitesse maximale')).toBeInTheDocument();
  },
};

export const DisplaysRecordValues = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
          return HttpResponse.json(mockRecords);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText('125 min')).toBeInTheDocument();
    });

    expect(canvasElement.getByText('2850 m')).toBeInTheDocument();
    expect(canvasElement.getByText('45.30 km')).toBeInTheDocument();
    expect(canvasElement.getByText('62.4 km/h')).toBeInTheDocument();
  },
};

export const ShowsLoadingSkeletons = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    // Check for loading state (animate-pulse class)
    const skeletons = canvas.querySelectorAll('.animate-pulse');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const ShowsErrorMessage = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText(/Erreur/)).toBeInTheDocument();
    });
  },
};

export const ShowsNoDataForMissingRecords = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/records', () => {
          return HttpResponse.json(mockPartialRecords);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    await waitFor(() => {
      expect(canvasElement.getByText('90 min')).toBeInTheDocument();
    });

    // Should show "Aucune donnée disponible" for missing records
    const noDataTexts = canvasElement.getAllByText('Aucune donnée disponible');
    expect(noDataTexts.length).toBe(2); // For distance and speed
  },
};
