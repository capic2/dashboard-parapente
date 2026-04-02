import preview from '../.storybook/preview';
import { IconCard } from './IconCard';

const meta = preview.meta({
  title: 'Components/UI/IconCard',
  component: IconCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A card component displaying an icon, title, and description with unlocked/locked states and optional progress indicator.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    icon: {
      control: 'text',
      description: 'Emoji or icon character to display',
    },
    title: {
      control: 'text',
      description: 'Card title',
    },
    description: {
      control: 'text',
      description: 'Card description text',
    },
    unlocked: {
      control: 'boolean',
      description: 'Whether the card is in unlocked state',
    },
    progress: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Progress percentage (0-100), shown only when locked',
    },
  },
});

export const Unlocked = meta.story({
  name: 'Unlocked',
  args: {
    icon: '🎖️',
    title: 'Experienced',
    description: '20 flights completed',
    unlocked: true,
  },
});

export const Locked = meta.story({
  name: 'Locked',
  args: {
    icon: '👑',
    title: 'Sky Master',
    description: 'Complete 100 flights',
    unlocked: false,
  },
});

export const LockedWithProgress = meta.story({
  name: 'Locked with Progress',
  args: {
    icon: '🏅',
    title: 'Veteran',
    description: 'Complete 50 flights',
    unlocked: false,
    progress: 65,
  },
});

export const AllStates = meta.story({
  name: 'All States',
  render: () => (
    <div className="grid grid-cols-3 gap-3" style={{ width: '500px' }}>
      <IconCard
        icon="🪂"
        title="First Flight"
        description="Complete your first flight"
        unlocked={true}
      />
      <IconCard
        icon="🏅"
        title="Veteran"
        description="Complete 50 flights"
        unlocked={false}
        progress={40}
      />
      <IconCard
        icon="🦅"
        title="Eagle"
        description="Reach 3000m altitude"
        unlocked={false}
      />
    </div>
  ),
});
