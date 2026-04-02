import preview from '../.storybook/preview';
import { expect } from 'storybook/test';
import LoadingSkeleton from './LoadingSkeleton';

const meta = preview.meta({
  title: 'Components/LoadingSkeleton',
  component: LoadingSkeleton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Loading skeleton component for displaying placeholder content while data is loading. Supports multiple types (card, chart, list, text) and can render multiple skeletons at once.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['card', 'chart', 'list', 'text'],
      description: 'Type of skeleton to display',
    },
    count: {
      control: 'number',
      description: 'Number of skeleton items to render',
    },
    height: {
      control: 'text',
      description: 'Custom height (CSS value like "200px" or "10rem")',
    },
  },
});

// Default card skeleton
export const Default = meta.story({
  args: {
    type: 'card',
    count: 1,
  },
});

// Test default rendering
Default.test(
  'should render single card skeleton',
  async ({ canvasElement }) => {
    const element = canvasElement.querySelector('.animate-pulse');
    await expect(element).toBeTruthy();
  }
);

// Card type
export const TypeCard = meta.story({
  name: 'Type: Card',
  args: {
    type: 'card',
    count: 1,
  },
});

// Chart type
export const TypeChart = meta.story({
  name: 'Type: Chart',
  args: {
    type: 'chart',
    count: 1,
  },
});

// List type
export const TypeList = meta.story({
  name: 'Type: List',
  args: {
    type: 'list',
    count: 1,
  },
});

// Text type
export const TypeText = meta.story({
  name: 'Type: Text',
  args: {
    type: 'text',
    count: 1,
  },
});

// Multiple cards
export const MultipleCards = meta.story({
  name: 'Multiple Cards',
  args: {
    type: 'card',
    count: 3,
  },
});

// Test multiple skeletons
MultipleCards.test(
  'should render multiple skeletons',
  async ({ canvasElement }) => {
    const elements = canvasElement.querySelectorAll('.animate-pulse');
    await expect(elements.length).toBe(3);
  }
);

// All types comparison
export const AllTypes = meta.story({
  name: 'All Types Comparison',
  render: () => (
    <div className="grid grid-cols-2 gap-6 max-w-4xl">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Card</h3>
        <LoadingSkeleton type="card" count={1} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Chart</h3>
        <LoadingSkeleton type="chart" count={1} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">List</h3>
        <LoadingSkeleton type="list" count={3} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Text</h3>
        <LoadingSkeleton type="text" count={2} />
      </div>
    </div>
  ),
});

// Test all types render
AllTypes.test('should render all skeleton types', async ({ canvasElement }) => {
  const elements = canvasElement.querySelectorAll('.animate-pulse');
  // 1 card + 1 chart + 3 lists + 2 texts = 7 skeletons
  await expect(elements.length).toBeGreaterThanOrEqual(6);
});
