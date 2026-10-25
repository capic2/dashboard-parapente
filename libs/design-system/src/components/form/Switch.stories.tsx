import preview from '../../../.storybook/preview';
import { Switch } from './Switch';

const meta = preview.meta({
  title: 'Components/Form/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: {
    children: 'Enable notifications',
    description: 'Receive updates when a flight finishes processing.',
  },
});

export const Default = meta.story({});

export const Selected = meta.story({
  args: { isSelected: true },
});

export const Disabled = meta.story({
  args: { isDisabled: true },
});
