import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import EmagramWidget from './EmagramWidget';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
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
} satisfies Meta<typeof EmagramWidget>;

export default meta;

const mockEmagramData = {
  levels: Array.from({ length: 20 }, (_, i) => ({
    altitude_m: i * 500,
    temperature_c: 15 - i * 0.65,
    dewpoint_c: 10 - i * 0.6,
    pressure_hpa: 1013 - i * 50,
  })),
};

export const Default = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/emagram/:spotId', () => {
          return HttpResponse.json(mockEmagramData);
        }),
      ],
    },
  },
};

export const Loading = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/emagram/:spotId', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
};

export const Error = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/emagram/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
};
