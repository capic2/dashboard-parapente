import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { delay, http, HttpResponse } from 'msw';
import { fn } from 'storybook/test';
import preview from '../../../../.storybook/preview';
import { IntervalsSyncModal } from './IntervalsSyncModal';

const readyStatus = {
  configured: true,
  enabled: true,
  automatic_sync_ready: true,
  awaiting_activity_type: false,
  interval_minutes: 30,
  lookback_days: 14,
  activity_types: ['Paragliding', 'Hike'],
};

const previewResponse = {
  activities: [
    {
      id: 'i12345',
      start_date_local: '2026-07-20T18:15:00',
      type: 'Paragliding',
      name: 'Arguel - soaring du soir',
      source: 'Zepp',
      file_type: 'FIT',
    },
    {
      id: 'i12346',
      start_date_local: '2026-07-22T09:30:00',
      type: 'Hike',
      name: 'Montée au décollage',
      source: 'Zepp',
      file_type: 'FIT',
    },
  ],
  activity_types: ['Paragliding', 'Hike'],
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });

const meta = preview.meta({
  title: 'Components/Forms/IntervalsSyncModal',
  component: IntervalsSyncModal,
  decorators: [
    (Story) => (
      <QueryClientProvider client={createQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
});

const baseArgs = {
  isOpen: true,
  onClose: fn(),
  onSyncComplete: fn(),
};

export const Preview = meta.story({
  args: baseArgs,
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/admin/intervals/status', () =>
          HttpResponse.json(readyStatus)
        ),
        http.get('*/api/flights/sync-intervals/preview', () =>
          HttpResponse.json(previewResponse)
        ),
        http.post('*/api/flights/sync-intervals', () =>
          HttpResponse.json({
            success: true,
            imported: 2,
            updated: 0,
            skipped: 0,
            failed: 0,
            flights: [],
          })
        ),
      ],
    },
  },
});

export const Empty = meta.story({
  args: baseArgs,
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/admin/intervals/status', () =>
          HttpResponse.json(readyStatus)
        ),
        http.get('*/api/flights/sync-intervals/preview', () =>
          HttpResponse.json({ activities: [], activity_types: [] })
        ),
      ],
    },
  },
});

export const Unconfigured = meta.story({
  args: baseArgs,
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/admin/intervals/status', () =>
          HttpResponse.json({
            ...readyStatus,
            configured: false,
            enabled: false,
            automatic_sync_ready: false,
            activity_types: [],
          })
        ),
      ],
    },
  },
});

export const Loading = meta.story({
  args: baseArgs,
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/admin/intervals/status', async () => {
          await delay('infinite');
          return HttpResponse.json(readyStatus);
        }),
      ],
    },
  },
});

export const Error = meta.story({
  args: baseArgs,
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/admin/intervals/status', () =>
          HttpResponse.json(
            { detail: 'Intervals.icu unavailable' },
            { status: 503 }
          )
        ),
      ],
    },
  },
});
