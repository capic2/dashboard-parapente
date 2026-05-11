import preview from '../../../.storybook/preview';
import { IconCard } from './IconCard';

function BadgeIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 18.75 12 16.5l-4.5 2.25V13.5A6 6 0 1 1 16.5 13.5v5.25Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 10.5 11.25 12l3-3"
      />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3.75 7.5 4.5 4.5 3.75-6 3.75 6 4.5-4.5v9.75a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V7.5Z"
      />
    </svg>
  );
}

function WingIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 12c4.5-4.5 9-6.75 16.5-6.75-1.5 5.25-5.25 9-11.25 11.25L6 20.25 6.75 15 3.75 12Z"
      />
    </svg>
  );
}

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
      control: false,
      description: 'Decorative SVG icon or React node to display',
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
    icon: <BadgeIcon />,
    title: 'Experienced',
    description: '20 flights completed',
    unlocked: true,
  },
});

export const Locked = meta.story({
  name: 'Locked',
  args: {
    icon: <CrownIcon />,
    title: 'Sky Master',
    description: 'Complete 100 flights',
    unlocked: false,
  },
});

export const LockedWithProgress = meta.story({
  name: 'Locked with Progress',
  args: {
    icon: <BadgeIcon />,
    title: 'Veteran',
    description: 'Complete 50 flights',
    unlocked: false,
    progress: 65,
  },
});

export const AllStates = meta.story({
  name: 'All States',
  render: () => (
    <div className="grid w-[min(100vw-2rem,500px)] grid-cols-1 gap-3 sm:grid-cols-3">
      <IconCard
        icon={<WingIcon />}
        title="First Flight"
        description="Complete your first flight"
        unlocked={true}
      />
      <IconCard
        icon={<BadgeIcon />}
        title="Veteran"
        description="Complete 50 flights"
        unlocked={false}
        progress={40}
      />
      <IconCard
        icon={<WingIcon />}
        title="Eagle"
        description="Reach 3000m altitude"
        unlocked={false}
      />
    </div>
  ),
});
