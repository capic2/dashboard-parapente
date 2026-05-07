import preview from '../../../.storybook/preview.tsx';
import { LoginForm } from './LoginForm.tsx';
import { fn } from 'storybook/test';

const meta = preview.meta({
  title: 'Components/Auth/LoginForm',
  component: LoginForm,
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const Default = meta.story({
  name: 'Default',
  args: {
    onSubmit: fn(),
  },
});
