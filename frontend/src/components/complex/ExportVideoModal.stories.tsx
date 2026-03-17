import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn } from 'storybook/test';
import { ExportVideoModal } from './ExportVideoModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
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
});

export default meta;

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
