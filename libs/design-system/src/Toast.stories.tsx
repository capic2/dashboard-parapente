import preview from '../../../apps/frontend/.storybook/preview';
import { fn, userEvent, within, expect } from 'storybook/test';
import { Toast } from './Toast';

const meta = preview.meta({
  title: 'Components/UI/Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Toast notification component for displaying temporary messages. Supports success, error, and info types with auto-close functionality.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    id: {
      control: 'text',
      description: 'Unique identifier for the toast',
    },
    title: {
      control: 'text',
      description: 'Message to display in the toast',
    },
    type: {
      control: 'select',
      options: ['success', 'error', 'info'],
      description: 'Type of toast (determines color and icon)',
    },
    onClose: {
      action: 'close-clicked',
      description: 'Callback when toast is closed',
    },
  },
});

// Success toast
export const Success = meta.story({
  name: 'Type: Success',
  args: {
    id: 'toast-success',
    title: 'Operation completed successfully!',
    type: 'success',
    onClose: fn(),
  },
});

// Test close button on success toast
Success.test(
  'should call onClose with correct ID when clicked',
  async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find and click the close button
    const closeButton = canvas.getByRole('button', { name: /×/i });
    await userEvent.click(closeButton);

    // Verify onClose was called with the correct ID
    await expect(args.onClose).toHaveBeenCalledWith('toast-success');
  }
);

// Error toast
export const Error = meta.story({
  name: 'Type: Error',
  args: {
    id: 'toast-error',
    title: 'An error occurred. Please try again.',
    type: 'error',
    onClose: fn(),
  },
});

// Info toast
export const Info = meta.story({
  name: 'Type: Info',
  args: {
    id: 'toast-info',
    title: 'New updates are available',
    type: 'info',
    onClose: fn(),
  },
});

// Long message toast
export const LongMessage = meta.story({
  name: 'Long Message',
  args: {
    id: 'toast-long',
    title:
      'This is a very long toast message that demonstrates how the component handles longer text content. It should wrap properly and maintain readability.',
    type: 'info',
    onClose: fn(),
  },
});

// Short message toast
export const ShortMessage = meta.story({
  name: 'Short Message',
  args: {
    id: 'toast-short',
    title: 'Done!',
    type: 'success',
    onClose: fn(),
  },
});

// All types comparison
export const AllTypes = meta.story({
  name: 'All Types Comparison',
  render: () => (
    <div className="space-y-3">
      <Toast
        id="success-compare"
        title="Success: Operation completed"
        type="success"
        onClose={() => {}}
      />
      <Toast
        id="error-compare"
        title="Error: Something went wrong"
        type="error"
        onClose={() => {}}
      />
      <Toast
        id="info-compare"
        title="Info: New notification"
        type="info"
        onClose={() => {}}
      />
    </div>
  ),
});
