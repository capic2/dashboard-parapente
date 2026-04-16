import preview from '../.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  title: 'Components/UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Shared responsive button primitive used across the app. It keeps touch targets large on mobile and exposes tones for common actions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'success',
        'warning',
        'danger',
        'accent',
        'cyan',
        'ghost',
        'outline',
      ],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon'],
    },
    fullWidth: {
      control: 'boolean',
    },
    children: {
      control: 'text',
    },
  },
});

export const Default = meta.story({
  args: {
    children: 'Primary action',
    tone: 'primary',
    size: 'md',
  },
});

export const Variants = meta.story({
  name: 'Variants',
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button tone="primary">Primary</Button>
      <Button tone="secondary">Secondary</Button>
      <Button tone="success">Success</Button>
      <Button tone="warning">Warning</Button>
      <Button tone="danger">Danger</Button>
      <Button tone="ghost">Ghost</Button>
      <Button tone="outline">Outline</Button>
    </div>
  ),
});

export const Sizes = meta.story({
  name: 'Sizes',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Action icon">
        ⟳
      </Button>
    </div>
  ),
});

export const FullWidth = meta.story({
  name: 'Full Width',
  args: {
    children: 'Full width action',
    fullWidth: true,
  },
});
