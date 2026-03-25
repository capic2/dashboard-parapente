import preview from '../../../apps/frontend/.storybook/preview'
import { fn, userEvent, within, expect } from 'storybook/test'
import { ToastContainer } from './Toast'

const meta = preview.meta({
  title: 'Components/UI/Toast/Container',
  component: ToastContainer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Container for displaying multiple toast notifications in the bottom-right corner. Automatically hides when empty.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    toasts: {
      description: 'Array of toast objects to display',
    },
    onClose: {
      action: 'toast-closed',
      description: 'Callback when a toast is closed',
    },
  },
})

// Empty container (should not render)
export const Empty = meta.story({
  name: 'Empty',
  args: {
    toasts: [],
    onClose: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'When there are no toasts, the container does not render anything.',
      },
    },
  },
})

// Container with single toast
export const SingleToast = meta.story({
  name: 'Single Toast',
  args: {
    toasts: [
      {
        id: 'toast-1',
        title: 'File uploaded successfully',
        type: 'success' as const,
      },
    ],
    onClose: fn(),
  },
})

// Test single toast close
SingleToast.test('should close toast when close button clicked', async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  
  // Find and click the close button
  const closeButton = canvas.getByRole('button', { name: /×/i })
  await userEvent.click(closeButton)
  
  // Verify onClose was called with the correct ID
  await expect(args.onClose).toHaveBeenCalledWith('toast-1')
})

// Container with multiple toasts
export const MultipleToasts = meta.story({
  name: 'Multiple Toasts',
  args: {
    toasts: [
      {
        id: 'toast-1',
        title: 'File uploaded successfully',
        type: 'success' as const,
      },
      {
        id: 'toast-2',
        title: 'Connection lost. Retrying...',
        type: 'error' as const,
      },
      {
        id: 'toast-3',
        title: 'New message received',
        type: 'info' as const,
      },
    ],
    onClose: fn(),
  },
})

// Test multiple toasts rendering
MultipleToasts.test('should render all toasts', async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  
  // Verify all three toasts are present
  await expect(canvas.getByText(/File uploaded successfully/i)).toBeInTheDocument()
  await expect(canvas.getByText(/Connection lost/i)).toBeInTheDocument()
  await expect(canvas.getByText(/New message received/i)).toBeInTheDocument()
})

// Container with many toasts (stacking)
export const ManyToasts = meta.story({
  name: 'Many Toasts',
  args: {
    toasts: [
      { id: '1', title: 'First notification', type: 'info' as const },
      { id: '2', title: 'Second notification', type: 'success' as const },
      { id: '3', title: 'Third notification', type: 'error' as const },
      { id: '4', title: 'Fourth notification', type: 'info' as const },
      { id: '5', title: 'Fifth notification', type: 'success' as const },
    ],
    onClose: fn(),
  },
})

// Container with mixed types
export const MixedTypes = meta.story({
  name: 'Mixed Types',
  args: {
    toasts: [
      {
        id: 'success-1',
        title: 'Site created successfully',
        type: 'success' as const,
      },
      {
        id: 'success-2',
        title: 'Flight data synced',
        type: 'success' as const,
      },
      {
        id: 'error-1',
        title: 'Failed to load weather data',
        type: 'error' as const,
      },
      {
        id: 'info-1',
        title: 'Update available',
        type: 'info' as const,
      },
    ],
    onClose: fn(),
  },
})

// Realistic use case: Sequential notifications
export const RealisticFlow = meta.story({
  name: 'Realistic Flow',
  args: {
    toasts: [
      {
        id: 'upload-start',
        title: 'Uploading flight data...',
        type: 'info' as const,
      },
      {
        id: 'upload-success',
        title: 'Flight uploaded successfully!',
        type: 'success' as const,
      },
      {
        id: 'sync-info',
        title: 'Syncing with Strava...',
        type: 'info' as const,
      },
    ],
    onClose: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of a realistic flow showing multiple sequential notifications.',
      },
    },
  },
})
