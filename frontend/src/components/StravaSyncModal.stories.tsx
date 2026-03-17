import type { Meta } from '@storybook/react';
import { expect, within, userEvent, waitFor } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { fn } from 'storybook/test';
import { StravaSyncModal } from './StravaSyncModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Forms/StravaSyncModal',
  component: StravaSyncModal,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StravaSyncModal>;

export default meta;

// Mock sync results
const mockSyncResult = {
  imported: 15,
  skipped: 3,
  failed: 0,
};

const mockSyncResultWithFailures = {
  imported: 10,
  skipped: 2,
  failed: 1,
};

const mockSyncResultNoSkipped = {
  imported: 8,
  skipped: 0,
  failed: 0,
};

// Closed state
export const Closed = {
  args: {
    isOpen: false,
    onClose: fn(),
    onSyncComplete: fn(),
  },
};

// Open - default state
export const Open = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', () => {
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
};

// Syncing in progress
export const SyncingInProgress = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay('infinite');
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const syncButton = canvas.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);
  },
};

// Sync success
export const SyncSuccess = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay(500);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const syncButton = canvas.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);
  },
};

// Sync with failures
export const SyncWithFailures = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay(500);
          return HttpResponse.json(mockSyncResultWithFailures);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const syncButton = canvas.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);
  },
};

// Sync no skipped
export const SyncNoSkipped = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay(500);
          return HttpResponse.json(mockSyncResultNoSkipped);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const syncButton = canvas.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);
  },
};

// Custom date range
export const CustomDateRange = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', () => {
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    // Change date from
    const dateFromInputs = canvas.getAllByRole('spinbutton');
    if (dateFromInputs[0]) {
      await user.clear(dateFromInputs[0]);
      await user.type(dateFromInputs[0], '2024');
    }
  },
};

// Interaction Tests

export const DisplaysModalTitle = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('🔄 Synchroniser avec Strava')).toBeInTheDocument();
    expect(canvasElement.getByText(/Importe tous les vols paragliding/)).toBeInTheDocument();
  },
};

export const DisplaysDatePickers = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    expect(canvasElement.getByText('Du')).toBeInTheDocument();
    expect(canvasElement.getByText('Au')).toBeInTheDocument();
  },
};

export const EnablesSyncButton = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const syncButton = canvasElement.getByText('🔄 Synchroniser');
    expect(syncButton).not.toBeDisabled();
  },
};

export const ShowsSyncingState = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const syncButton = canvasElement.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);

    await waitFor(() => {
      expect(canvasElement.getByText(/Synchronisation.../)).toBeInTheDocument();
    });
  },
};

export const ShowsSuccessMessage = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const syncButton = canvasElement.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);

    await waitFor(() => {
      expect(canvasElement.getByText('✅ Synchronisation terminée')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(canvasElement.getByText(/15 vols importés/)).toBeInTheDocument();
    expect(canvasElement.getByText(/3 vols ignorés/)).toBeInTheDocument();
  },
};

export const ShowsFailures = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResultWithFailures);
        }),
      ],
    },
  },
  test: async ({ canvas }: { canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const syncButton = canvasElement.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);

    await waitFor(() => {
      expect(canvasElement.getByText(/1 échecs/)).toBeInTheDocument();
    }, { timeout: 3000 });
  },
};

export const CallsOnSyncComplete = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:5000/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const syncButton = canvasElement.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);

    await waitFor(() => {
      expect(args.onSyncComplete).toHaveBeenCalled();
    }, { timeout: 3000 });
  },
};

export const ClosesModalOnCancel = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  test: async ({ args, canvas }: { args: any; canvas: HTMLElement }) => {
    const canvasElement = within(canvas);

    const cancelButton = canvasElement.getByText('Annuler');
    await userEvent.click(cancelButton);

    expect(args.onClose).toHaveBeenCalled();
  },
};
