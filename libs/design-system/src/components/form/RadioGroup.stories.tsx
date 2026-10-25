import preview from '../../../.storybook/preview';
import { RadioGroup } from './RadioGroup';

const meta = preview.meta({
  title: 'Components/Form/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  args: {
    label: 'Visibility',
    description: 'Choose who can see this flight.',
    options: [
      {
        value: 'private',
        label: 'Private',
        description: 'Only you can see it.',
      },
      { value: 'public', label: 'Public', description: 'Visible to everyone.' },
    ],
    defaultValue: 'private',
  },
});

export const Vertical = meta.story({});

export const Horizontal = meta.story({
  args: { orientation: 'horizontal' },
});

export const Invalid = meta.story({
  args: {
    value: undefined,
    defaultValue: undefined,
    errorMessage: 'Choose a visibility option.',
  },
});
