import preview from '../../../.storybook/preview';
import { Checkbox } from './Checkbox';

const meta = preview.meta({
  title: 'Components/Form/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  args: {
    children: 'Send me flight summaries',
    description: 'You can change this preference at any time.',
  },
});

export const Default = meta.story({});

export const Selected = meta.story({
  args: { isSelected: true },
});

export const Indeterminate = meta.story({
  args: { isIndeterminate: true },
});

export const Disabled = meta.story({
  args: { isDisabled: true },
});
