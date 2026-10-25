import preview from '../../../.storybook/preview';
import { TextArea } from './TextArea';

const meta = preview.meta({
  title: 'Components/Form/TextArea',
  component: TextArea,
  tags: ['autodocs'],
  args: {
    label: 'Flight notes',
    placeholder: 'Add details about this flight…',
    description: 'These notes are only visible to you.',
  },
});

export const Default = meta.story({});

export const Invalid = meta.story({
  args: { errorMessage: 'Please add a short description.' },
});
