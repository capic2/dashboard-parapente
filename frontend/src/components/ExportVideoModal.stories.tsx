import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn } from 'storybook/test';
import { ExportVideoModal } from './ExportVideoModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Complex/ExportVideoModal',
  component: ExportVideoModal,
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
} satisfies Meta<typeof ExportVideoModal>;

export default meta;

export const Closed = {
  args: {
    isOpen: false,
    flightId: 'flight-1',
    onClose: fn(),
  },
};

export const Open = {
  args: {
    isOpen: true,
    flightId: 'flight-1',
    onClose: fn(),
  },
};

export const Processing = {
  args: {
    isOpen: true,
    flightId: 'flight-1',
    onClose: fn(),
  },
};
