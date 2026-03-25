import preview from '../.storybook/preview';
import { fn, userEvent, expect, screen } from 'storybook/test';
import { Modal } from './Modal';

const meta = preview.meta({
  title: 'Components/UI/Modal',
  component: Modal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Modal component using react-aria-components. Supports multiple sizes, backdrop overlay, and accessible keyboard/focus management.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Controls whether the modal is visible',
    },
    onClose: {
      action: 'close-clicked',
      description: 'Callback when modal is closed',
    },
    title: {
      control: 'text',
      description: 'Modal title displayed in header',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Modal width size',
    },
    children: {
      description: 'Modal content',
    },
  },
});

/*
// Default modal with medium size
export const Default = meta.story({
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Modal Title',
    size: 'md',
    children: (
      <div>
        <p className="text-gray-700 mb-4">
          This is the modal content. You can put anything here.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Confirm
          </button>
        </div>
      </div>
    ),
  },
});

// Test close button interaction
Default.test(
  'should call onClose when close button clicked',
  async ({ args }) => {
    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: /×/i });
    await userEvent.click(closeButton);

    // Verify onClose was called
    await expect(args.onClose).toHaveBeenCalled();
  }
);
*/

// Small size modal
export const SizeSmall = meta.story({
  name: 'Size: Small',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Small Modal',
    size: 'sm',
    children: (
      <p className="text-gray-700">
        This is a small modal (max-width: 28rem / 448px)
      </p>
    ),
  },
});

// Medium size modal (default)
export const SizeMedium = meta.story({
  name: 'Size: Medium',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Medium Modal',
    size: 'md',
    children: (
      <p className="text-gray-700">
        This is a medium modal (max-width: 32rem / 512px) - This is the default
        size.
      </p>
    ),
  },
});

// Large size modal
export const SizeLarge = meta.story({
  name: 'Size: Large',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Large Modal',
    size: 'lg',
    children: (
      <div>
        <p className="text-gray-700 mb-4">
          This is a large modal (max-width: 42rem / 672px). Perfect for forms or
          detailed content.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-100 rounded">Column 1</div>
          <div className="p-4 bg-gray-100 rounded">Column 2</div>
        </div>
      </div>
    ),
  },
});

// Extra large size modal
export const SizeExtraLarge = meta.story({
  name: 'Size: Extra Large',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Extra Large Modal',
    size: 'xl',
    children: (
      <div>
        <p className="text-gray-700 mb-4">
          This is an extra large modal (max-width: 56rem / 896px). Use for
          complex layouts or data tables.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-100 rounded">Column 1</div>
          <div className="p-4 bg-gray-100 rounded">Column 2</div>
          <div className="p-4 bg-gray-100 rounded">Column 3</div>
        </div>
      </div>
    ),
  },
});

// Modal with long content (scrollable)
export const LongContent = meta.story({
  name: 'Long Content (Scrollable)',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Modal with Long Content',
    size: 'md',
    children: (
      <div>
        <p className="text-gray-700 mb-4">
          This modal demonstrates scrollable content when the content exceeds
          90vh.
        </p>
        {Array.from({ length: 20 }, (_, i) => (
          <p key={i} className="text-gray-600 mb-2">
            Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur
            adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua.
          </p>
        ))}
      </div>
    ),
  },
});

// Modal with form content
export const WithForm = meta.story({
  name: 'With Form',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Create New Site',
    size: 'lg',
    children: (
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Site Name
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter site name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude
            </label>
            <input
              type="number"
              step="0.0001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="47.2400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude
            </label>
            <input
              type="number"
              step="0.0001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="6.0200"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Site
          </button>
        </div>
      </form>
    ),
  },
});

// Test form interaction
WithForm.test('should fill form fields', async () => {
  // Fill in form fields
  const nameInput = screen.getByPlaceholderText('Enter site name');
  await userEvent.type(nameInput, 'Mont Poupet');

  const latInput = screen.getByPlaceholderText('47.2400');
  await userEvent.type(latInput, '46.9');

  // Verify inputs have values
  await expect(nameInput).toHaveValue('Mont Poupet');
  await expect(latInput).toHaveValue(46.9);
});

// Closed modal (not visible)
export const Closed = meta.story({
  name: 'Closed State',
  args: {
    isOpen: false,
    onClose: fn(),
    title: 'This Modal is Closed',
    children: <p>You should not see this content.</p>,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When isOpen is false, the modal is not rendered and not visible.',
      },
    },
  },
});

// Modal with minimal content
export const MinimalContent = meta.story({
  name: 'Minimal Content',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Confirm Action',
    size: 'sm',
    children: (
      <div>
        <p className="text-gray-700 mb-4">Are you sure you want to continue?</p>
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            No
          </button>
          <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Yes, Delete
          </button>
        </div>
      </div>
    ),
  },
});

// Test confirmation buttons
MinimalContent.test(
  'should have confirmation buttons',
  async () => {
    // Verify both action buttons are present
    const noButton = screen.getByText('No');
    const deleteButton = screen.getByText('Yes, Delete');

    await expect(noButton).toBeInTheDocument();
    await expect(deleteButton).toBeInTheDocument();
  }
);

// Modal with rich content (images, lists, etc.)
export const RichContent = meta.story({
  name: 'Rich Content',
  args: {
    isOpen: true,
    onClose: fn(),
    title: 'Flight Details',
    size: 'lg',
    children: (
      <div>
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            Flight Information
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-600">Date:</dt>
            <dd className="text-gray-900">March 15, 2024</dd>
            <dt className="text-gray-600">Duration:</dt>
            <dd className="text-gray-900">2h 30min</dd>
            <dt className="text-gray-600">Max Altitude:</dt>
            <dd className="text-gray-900">1,850m</dd>
            <dt className="text-gray-600">Distance:</dt>
            <dd className="text-gray-900">25.4 km</dd>
          </dl>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            Weather Conditions
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-700">
            <li>Wind: 12 km/h NE</li>
            <li>Temperature: 18°C</li>
            <li>Cloud cover: 25%</li>
          </ul>
        </div>

        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Close
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Export GPX
          </button>
        </div>
      </div>
    ),
  },
});
