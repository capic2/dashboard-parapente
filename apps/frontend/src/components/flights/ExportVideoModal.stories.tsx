import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn } from 'storybook/test';
import { ExportVideoModal } from './ExportVideoModal';

const meta = preview.meta({
  title: 'Components/Complex/ExportVideoModal',
  component: ExportVideoModal,
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



export const Closed = meta.story({
  args: {
    isOpen: false,
    flightDuration: 120,
    onExport: fn(),
    onCancel: fn(),
  },
});

export const Open = meta.story({
  args: {
    isOpen: true,
    flightDuration: 120,
    onExport: fn(),
    onCancel: fn(),
  },
});

export const Processing = meta.story({
  args: {
    isOpen: true,
    flightDuration: 180,
    onExport: fn(),
    onCancel: fn(),
  },
});
