import preview from '../../../.storybook/preview';
import { TextField } from '@dashboard-parapente/design-system/form';

const meta = preview.meta({
  title: 'Components/Form/TextField',
  component: TextField,
  tags: ['autodocs'],
  args: {
    label: 'Email address',
    type: 'email',
    placeholder: 'name@example.com',
    description: 'We will use this address for account updates.',
  },
});

export const Default = meta.story({});

export const Required = meta.story({
  args: { isRequired: true },
});

export const Invalid = meta.story({
  args: { value: 'not-an-email', errorMessage: 'Enter a valid email address.' },
});

export const Disabled = meta.story({
  args: { value: 'pilot@example.com', isDisabled: true },
});
