import preview from '../.storybook/preview';
import { expect, fn } from 'storybook/test';
import { Select } from './Select';

const siteOptions = [
  { id: 'arguel', label: 'Arguel' },
  { id: 'poupet-nord', label: 'Mont Poupet Nord' },
  { id: 'poupet-sud', label: 'Mont Poupet Sud' },
  { id: 'la-cote', label: 'La Côte' },
];

const meta = preview.meta({
  title: 'Components/UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Select dropdown component built on react-aria-components. Supports keyboard navigation, screen readers, and dark mode.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Label text displayed above the select',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text shown when no option is selected',
    },
    value: {
      control: 'text',
      description: 'Currently selected option id (null for none)',
    },
    onChange: {
      action: 'selection-changed',
      description: 'Callback when selection changes',
    },
  },
});

export const Default = meta.story({
  args: {
    label: 'Site',
    options: siteOptions,
    value: null,
    onChange: fn(),
    placeholder: 'Tous les sites',
  },
});

export const WithSelection = meta.story({
  args: {
    label: 'Site',
    options: siteOptions,
    value: 'arguel',
    onChange: fn(),
    placeholder: 'Tous les sites',
  },
});

WithSelection.test('shows selected value', async ({ canvas }) => {
  await expect(canvas.getByText('Arguel', {selector: 'span'})).toBeInTheDocument();
});

export const NoPlaceholder = meta.story({
  args: {
    label: 'Catégorie',
    options: [
      { id: 'takeoff', label: 'Décollage' },
      { id: 'landing', label: 'Atterrissage' },
      { id: 'both', label: 'Les deux' },
    ],
    value: null,
    onChange: fn(),
  },
});
