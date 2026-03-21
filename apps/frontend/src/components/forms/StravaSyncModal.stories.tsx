import preview from '../../../.storybook/preview';
import { fn } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { StravaSyncModal } from './StravaSyncModal';

const meta = preview.meta({
  title: 'Components/Forms/StravaSyncModal',
  component: StravaSyncModal,
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
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

export default meta;

// Mock sync results
const mockSyncResult = {
  imported: 15,
  skipped: 3,
  failed: 0,
};

/*const mockSyncResultWithFailures = {
  imported: 10,
  skipped: 2,
  failed: 1,
};*/

/*const mockSyncResultNoSkipped = {
  imported: 8,
  skipped: 0,
  failed: 0,
};*/

// Closed state
export const Closed = meta.story({
  args: {
    isOpen: false,
    onClose: fn(),
    onSyncComplete: fn(),
  },
});

// Open - default state
export const Open = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', () => {
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
});

/*
// Syncing in progress
export const SyncingInProgress = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay('infinite');
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
});

SyncingInProgress.test("interaction test", async ({ canvas }) => {
  const syncButton = canvas.getByText('🔄 Synchroniser');
  await userEvent.click(syncButton);
});

// Sync success
export const SyncSuccess = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay(500);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
});

SyncSuccess.test("interaction test", async ({ canvas }) => {
  const syncButton = canvas.getByText('🔄 Synchroniser');
  await userEvent.click(syncButton);
});

// Sync with failures
export const SyncWithFailures = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay(500);
          return HttpResponse.json(mockSyncResultWithFailures);
        }),
      ],
    },
  },
});

SyncWithFailures.test("interaction test", async ({ canvas }) => {
  const syncButton = canvas.getByText('🔄 Synchroniser');
  await userEvent.click(syncButton);
});

// Sync no skipped
export const SyncNoSkipped = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay(500);
          return HttpResponse.json(mockSyncResultNoSkipped);
        }),
      ],
    },
  },
});

SyncNoSkipped.test("interaction test", async ({ canvas }) => {
  const syncButton = canvas.getByText('🔄 Synchroniser');
  await userEvent.click(syncButton);
});
*/
/*

// Custom date range
export const CustomDateRange = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', () => {
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
});

CustomDateRange.test('interaction test', async ({ canvas }) => {
  const user = userEvent.setup();

  // Change date from
  const dateFromInputs = canvas.getAllByRole('spinbutton');
  if (dateFromInputs[0]) {
    await user.clear(dateFromInputs[0]);
    await user.type(dateFromInputs[0], '2024');
  }
});

// Interaction Tests

export const DisplaysModalTitle = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
});

DisplaysModalTitle.test(
  'displays modal title and instructions',
  async ({ canvas }) => {
    await expect(
      canvas.getByText('🔄 Synchroniser avec Strava')
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Importe tous les vols paragliding/)
    ).toBeInTheDocument();
  }
);

export const DisplaysDatePickers = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
});

DisplaysDatePickers.test('displays date pickers', async ({ canvas }) => {
  await expect(canvas.getByText('Du')).toBeInTheDocument();
  await expect(canvas.getByText('Au')).toBeInTheDocument();
});

export const EnablesSyncButton = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
});

EnablesSyncButton.test('enables sync button by default', async ({ canvas }) => {
  const syncButton = canvas.getByText('🔄 Synchroniser');
  await expect(syncButton).not.toBeDisabled();
});

export const ShowsSyncingState = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
});

ShowsSyncingState.test(
  'shows syncing state during sync',
  async ({ canvas }) => {
    const syncButton = canvas.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);

    await waitFor(() => {
      expect(canvas.getByText(/Synchronisation.../)).toBeInTheDocument();
    });
  }
);

export const ShowsSuccessMessage = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
});

ShowsSuccessMessage.test(
  'shows success message after sync',
  async ({ canvas }) => {
    const syncButton = canvas.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);

    await waitFor(
      () => {
        expect(
          canvas.getByText('✅ Synchronisation terminée')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    await expect(canvas.getByText(/15 vols importés/)).toBeInTheDocument();
    await expect(canvas.getByText(/3 vols ignorés/)).toBeInTheDocument();
  }
);

export const ShowsFailures = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResultWithFailures);
        }),
      ],
    },
  },
});

ShowsFailures.test('shows failure count', async ({ canvas }) => {
  const syncButton = canvas.getByText('🔄 Synchroniser');
  await userEvent.click(syncButton);

  await waitFor(
    () => {
      expect(canvas.getByText(/1 échecs/)).toBeInTheDocument();
    },
    { timeout: 3000 }
  );
});

export const CallsOnSyncComplete = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/strava/sync', async () => {
          await delay(100);
          return HttpResponse.json(mockSyncResult);
        }),
      ],
    },
  },
});

CallsOnSyncComplete.test(
  'calls onSyncComplete callback',
  async ({ args, canvas }) => {
    const syncButton = canvas.getByText('🔄 Synchroniser');
    await userEvent.click(syncButton);

    await waitFor(
      () => {
        expect(args.onSyncComplete).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  }
);

export const ClosesModalOnCancel = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    onSyncComplete: fn(),
  },
});

ClosesModalOnCancel.test(
  'closes modal on cancel click',
  async ({ args, canvas }) => {
    const cancelButton = canvas.getByText('Annuler');
    await userEvent.click(cancelButton);

    await expect(args.onClose).toHaveBeenCalled();
  }
);
*/
