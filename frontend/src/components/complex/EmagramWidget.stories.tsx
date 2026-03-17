import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import EmagramWidget from './EmagramWidget';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Complex/EmagramWidget',
  component: EmagramWidget,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '800px', padding: '20px' }}>
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

const mockEmagramData = {
  levels: Array.from({ length: 20 }, (_, i) => ({
    altitude_m: i * 500,
    temperature_c: 15 - i * 0.65,
    dewpoint_c: 10 - i * 0.6,
    pressure_hpa: 1013 - i * 50,
  })),
};

export const Default = meta.story({
  args: {
    userLat: 47.238,
    userLon: 6.024,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram*', () => {
          return HttpResponse.json(mockEmagramData);
        }),
      ],
    },
  },
});

export const Loading = meta.story({
  args: {
    userLat: 47.238,
    userLon: 6.024,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

export const Error = meta.story({
  args: {
    userLat: 47.238,
    userLon: 6.024,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});
